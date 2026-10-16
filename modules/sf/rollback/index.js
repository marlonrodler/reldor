'use strict';

const fs = require('node:fs');
const path = require('node:path');
const gitApi = require('../../../core/git');
const { memberOf, manifest } = require('../metadata/types');

const git = (root, args) => gitApi.git(root, args);
const lines = (r) => (r.ok && r.stdout ? r.stdout.split('\n').filter(Boolean) : []);

/** Notes about deleting a metadata type in the org. */
const DELETE_NOTES = {
  CustomField: 'os dados do campo são apagados (ficam 15 dias na lixeira de campos)',
  CustomObject: 'todos os registros do objeto são apagados',
  Flow: 'desative a versão ativa antes; flows com entrevistas pausadas não podem ser apagados',
  ApexClass: 'confira se a classe não está agendada (Scheduled Jobs) nem em uso por outro metadado',
  ApexTrigger: 'a automação para na hora: confira se outro processo depende dela',
  RecordType: 'não dá para apagar se ainda existirem registros com esse record type; normalmente se desativa',
  PermissionSet: 'remova as atribuições a usuários antes',
};

/**
 * Finds the merge commit of a pull request (or takes a commit/branch) on the environment branches.
 * Returns { merge, env, envRef, envs: [names where it is] } or null.
 */
function locate(root, environments, wanted) {
  const refs = environments.map((e) => ({ name: e.name, ref: gitApi.resolveBranch(root, e.branch) })).filter((r) => r.ref);
  const asNumber = /^#?(\d+)$/.exec(String(wanted));
  let merge = null;
  if (asNumber) {
    const n = asNumber[1];
    const re = new RegExp(`(pull request #${n}\\b|Merged PR ${n}\\b|\\(#${n}\\)|#${n}\\b)`, 'i');
    for (const r of [...refs].reverse()) {
      for (const row of lines(git(root, ['log', '--merges', '--format=%H%x09%s', '-n', '2000', r.ref]))) {
        const [hash, subject] = row.split('\t');
        if (re.test(subject)) {
          merge = hash;
          break;
        }
      }
      if (merge) break;
    }
  } else {
    const sha = git(root, ['rev-parse', '--verify', '--quiet', `${wanted}^{commit}`]).stdout;
    if (sha) merge = sha;
  }
  if (!merge) return null;
  const envs = refs.filter((r) => git(root, ['merge-base', '--is-ancestor', merge, r.ref]).code === 0);
  const home = envs[envs.length - 1] || refs[refs.length - 1];
  return { merge, envs: envs.map((e) => e.name), env: home ? home.name : null, envRef: home ? home.ref : null };
}

/**
 * Rollback plan for a pull request, a merge commit, a commit or a feature branch. Changes nothing in Git;
 * writes the manifests under .reldor/work/rollback-<id>/.
 */
function planRollback(root, config, { target, apiVersion = '61.0' }) {
  const environments = config.environments || [];
  const found = locate(root, environments, target);
  if (!found) throw new Error(`Não achei "${target}". Use o número da PR, o hash do commit de merge ou o nome da branch (rode com --fetch se ela for remota).`);
  const { merge } = found;
  const parents = git(root, ['rev-list', '--parents', '-n', '1', merge]).stdout.split(' ').slice(1);
  const isMerge = parents.length > 1;

  let from;
  let commits;
  const production = environments.length ? gitApi.resolveBranch(root, environments[environments.length - 1].branch) : null;
  if (isMerge) {
    from = parents[0];
    commits = lines(git(root, ['log', '--no-merges', '--format=%H%x09%h%x09%an%x09%s', `${parents[0]}..${parents[1]}`]));
  } else if (gitApi.resolveBranch(root, target) && production) {
    // A feature branch: only its own commits.
    from = git(root, ['merge-base', production, merge]).stdout;
    commits = lines(git(root, ['log', '--no-merges', '--format=%H%x09%h%x09%an%x09%s', `${from}..${merge}`]));
  } else {
    from = parents[0];
    commits = lines(git(root, ['log', '-n', '1', '--format=%H%x09%h%x09%an%x09%s', merge]));
  }
  commits = commits.map((l) => {
    const [hash, short, author, ...subject] = l.split('\t');
    return { hash, short, author, subject: subject.join('\t') };
  });

  const changes = lines(git(root, ['diff', '--name-status', '-M', from, merge])).map((l) => {
    const [status, a, b] = l.split('\t');
    return status.startsWith('R') ? [{ status: 'D', file: a }, { status: 'A', file: b }] : [{ status: status[0], file: a }];
  }).flat();

  const destructive = new Map();
  const restore = new Map();
  const unknown = [];
  const bundles = new Map();
  for (const c of changes) {
    const m = memberOf(c.file);
    if (!m) {
      if (!/(^|\/)(\.|README|package\.json|sfdx-project\.json)/i.test(c.file) && !/\.md$/i.test(c.file)) unknown.push(c.file);
      continue;
    }
    const key = `${m.type}:${m.member}`;
    if (m.type === 'LightningComponentBundle' || m.type === 'AuraDefinitionBundle') {
      if (!bundles.has(key)) bundles.set(key, { m, added: true });
      if (c.status !== 'A') bundles.get(key).added = false;
      continue;
    }
    if (c.status === 'A' && !m.container) destructive.set(key, { ...m, file: c.file });
    else restore.set(key, { ...m, file: c.file, action: c.status === 'D' ? 'volta a existir' : 'volta à versão anterior' });
  }
  for (const [key, b] of bundles) {
    // A bundle is only deleted when the whole bundle was new.
    const stillThere = lines(git(root, ['ls-tree', '-r', '--name-only', from])).some((f) => memberOf(f)?.member === b.m.member && memberOf(f)?.type === b.m.type);
    if (b.added && !stillThere) destructive.set(key, b.m);
    else restore.set(key, { ...b.m, action: 'volta à versão anterior' });
  }

  // Risks
  const envRef = found.envRef || merge;
  const later = [];
  for (const c of changes) {
    const after = lines(git(root, ['log', '--no-merges', '--format=%h%x09%an%x09%s', `${merge}..${envRef}`, '--', c.file]));
    if (after.length) later.push({ file: c.file, commits: after.map((l) => l.split('\t')).map(([h, a, s]) => ({ hash: h, author: a, subject: s })) });
  }
  const changedFiles = new Set(changes.map((c) => c.file));
  const deletedFiles = new Set(changes.filter((c) => c.status === 'A').map((c) => c.file));
  const stillUsed = [];
  for (const d of destructive.values()) {
    const name = d.member.split('.').pop();
    if (name.length < 4) continue;
    const hits = lines(git(root, ['grep', '-l', '-w', '-i', '-F', name, envRef, '--']))
      .map((h) => h.replace(`${envRef}:`, ''))
      .filter((f) => !deletedFiles.has(f) && memberOf(f)?.member !== d.member)
      // Files the PR changed go back to their old version with the revert: only a reference that was already there counts.
      .filter((f) => !changedFiles.has(f) || new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(git(root, ['show', `${from}:${f}`]).stdout || ''));
    if (hits.length) stillUsed.push({ item: `${d.type} ${d.member}`, files: hits.slice(0, 10), more: Math.max(0, hits.length - 10) });
  }

  const id = /^#?\d+$/.test(String(target)) ? `pr-${String(target).replace('#', '')}` : String(target).replace(/[^\w.-]+/g, '-').slice(0, 40);
  const dir = path.join(root, '.reldor', 'work', `rollback-${id}`);
  fs.mkdirSync(dir, { recursive: true });
  const destructiveList = [...destructive.values()];
  fs.writeFileSync(path.join(dir, 'package.xml'), manifest([], apiVersion));
  fs.writeFileSync(path.join(dir, 'destructiveChanges.xml'), manifest(destructiveList, apiVersion));
  const rel = (f) => path.relative(root, f).split(path.sep).join('/');

  // Where the change is: environments that already have the newest commit of the feature.
  const newest = commits.length ? commits[0].hash : merge;
  const where = environments.map((e) => ({ name: e.name, ref: gitApi.resolveBranch(root, e.branch) })).filter((e) => e.ref && git(root, ['merge-base', '--is-ancestor', newest, e.ref]).code === 0).map((e) => e.name);

  return {
    target: String(target),
    id,
    merge: merge.slice(0, 9),
    isMerge,
    environments: where,
    commits,
    destructive: destructiveList.map((d) => ({ type: d.type, member: d.member, note: DELETE_NOTES[d.type] || null })),
    restore: [...restore.values()].map((r) => ({ type: r.type, member: r.member, action: r.action })),
    unknown,
    later,
    stillUsed,
    manifests: { package: rel(path.join(dir, 'package.xml')), destructive: rel(path.join(dir, 'destructiveChanges.xml')) },
  };
}

module.exports = { planRollback, locate };
