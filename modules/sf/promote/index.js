'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const gitApi = require('../../../core/git');
const { isOrganizable } = require('../xml/rules');
const { mergeXml } = require('../merge/xml-merge');
const { stripComments } = require('../quality/tokens');

const git = (root, args) => gitApi.git(root, args);
const lines = (r) => (r.ok && r.stdout ? r.stdout.split('\n').filter(Boolean) : []);

/** Finds an environment by name or branch ("uat" also matches "rc/uat/develop"). */
function findEnvironment(environments, wanted) {
  const w = String(wanted || '').toLowerCase();
  const exact = environments.findIndex((e) => e.name.toLowerCase() === w || String(e.branch).toLowerCase() === w);
  if (exact >= 0) return exact;
  return environments.findIndex((e) => e.name.toLowerCase().includes(w) || String(e.branch).toLowerCase().split('/').includes(w));
}

/** Commits as { hash, author, subject }. */
function commitList(root, range) {
  return lines(git(root, ['log', '--no-merges', '--format=%h%x09%an%x09%ae%x09%s', ...range])).map((l) => {
    const [hash, author, email, ...subject] = l.split('\t');
    return { hash, author, email, subject: subject.join('\t') };
  });
}

const isAncestor = (root, a, b) => git(root, ['merge-base', '--is-ancestor', a, b]).code === 0;

/**
 * Simulates `git merge source` on top of target without touching your working tree.
 * Uses `git merge-tree --write-tree` (Git 2.38+); older Git falls back to a temporary worktree.
 */
function simulateMerge(root, target, source, { worktree = true } = {}) {
  // Resolve now: inside a temporary worktree, "HEAD" would mean the worktree itself.
  source = git(root, ['rev-parse', source]).stdout || source;
  target = git(root, ['rev-parse', target]).stdout || target;
  const mt = git(root, ['merge-tree', '--write-tree', '--name-only', '--no-messages', target, source]);
  if (mt.code === 0 || (mt.code === 1 && /^[0-9a-f]{40,64}$/.test(mt.stdout.split('\n')[0]))) {
    const [tree, ...rest] = mt.stdout.split('\n');
    const conflicts = [...new Set(rest.filter(Boolean))];
    return { method: 'merge-tree', conflicts, files: lines(git(root, ['ls-tree', '-r', '--name-only', tree])) };
  }
  if (!worktree) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-ensaio-'));
  try {
    const add = git(root, ['worktree', 'add', '--detach', '--quiet', dir, target]);
    if (!add.ok) throw new Error(`não consegui simular o merge: ${add.stderr}`);
    gitApi.git(dir, ['-c', 'user.name=reldor', '-c', 'user.email=reldor@local', 'merge', '--no-commit', '--no-ff', '--quiet', source]);
    const conflicts = lines(gitApi.git(dir, ['diff', '--name-only', '--diff-filter=U']));
    const files = [...new Set(lines(gitApi.git(dir, ['ls-files'])))];
    gitApi.git(dir, ['merge', '--abort']);
    return { method: 'worktree', conflicts, files };
  } finally {
    git(root, ['worktree', 'remove', '--force', dir]);
    fs.rmSync(dir, { recursive: true, force: true });
    git(root, ['worktree', 'prune']);
  }
}

/** Metadata names present in a list of paths. */
function catalog(paths) {
  const fields = new Set(); // Object.Field__c
  const fieldNames = new Set(); // Field__c (lowercase)
  const objects = new Set(); // lowercase
  const classes = new Map(); // lowercase -> name
  for (const p of paths) {
    let m = /(?:^|\/)objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/.exec(p);
    if (m) {
      fields.add(`${m[1]}.${m[2]}`.toLowerCase());
      fieldNames.add(m[2].toLowerCase());
    }
    m = /(?:^|\/)objects\/([^/]+)\//.exec(p);
    if (m) objects.add(m[1].toLowerCase());
    m = /(?:^|\/)classes\/([^/]+)\.cls$/.exec(p);
    if (m) classes.set(m[1].toLowerCase(), m[1]);
  }
  return { fields, fieldNames, objects, classes };
}

/**
 * What the changed files reference that will not exist in the target after the merge
 * (but exists in some other environment or in your branch): the "field only exists in develop" case.
 */
function missingDependencies(root, { source, mergeBase, mergedFiles, refs }) {
  const merged = catalog(mergedFiles);
  const perRef = refs.map((r) => ({ ...r, cat: catalog(lines(git(root, ['ls-tree', '-r', '--name-only', r.ref]))) }));
  const changed = lines(git(root, ['diff', '--name-only', '--diff-filter=AMR', mergeBase, source]));
  const missing = new Map();
  const note = (item, kind, file, whereFn) => {
    if (!missing.has(item)) missing.set(item, { item, kind, files: new Set(), presentIn: perRef.filter(whereFn).map((r) => r.name) });
    missing.get(item).files.add(file);
  };
  for (const file of changed) {
    if (!/\.(cls|trigger|js|html|page|component|xml)$/i.test(file)) continue;
    const show = git(root, ['show', `${source}:${file}`]);
    if (!show.ok || show.stdout.length > 1_000_000) continue;
    const text = /\.(cls|trigger|js)$/i.test(file) ? stripComments(show.stdout) : show.stdout;
    const own = path.basename(file).replace(/\..*$/, '').toLowerCase();
    const explicit = new Set();
    for (const m of text.matchAll(/\b(\w+)\.(\w+__c)\b/g)) {
      const key = `${m[1]}.${m[2]}`.toLowerCase();
      if (!perRef.some((r) => r.cat.fields.has(key))) continue;
      explicit.add(m[2].toLowerCase());
      if (!merged.fields.has(key)) note(`${m[1]}.${m[2]}`, 'campo', file, (r) => r.cat.fields.has(key));
    }
    for (const m of text.matchAll(/\b(\w+__(?:c|mdt|e))\b/g)) {
      const name = m[1].toLowerCase();
      if (explicit.has(name)) continue;
      if (perRef.some((r) => r.cat.objects.has(name))) {
        if (!merged.objects.has(name)) note(m[1], 'objeto', file, (r) => r.cat.objects.has(name));
      } else if (perRef.some((r) => r.cat.fieldNames.has(name)) && !merged.fieldNames.has(name)) {
        note(m[1], 'campo', file, (r) => r.cat.fieldNames.has(name));
      }
    }
    if (/\.(cls|trigger|js|page|component)$/i.test(file) || /\.flow-meta\.xml$/i.test(file)) {
      for (const m of text.matchAll(/\b([A-Za-z]\w{3,})\b/g)) {
        const name = m[1].toLowerCase();
        if (name === own || merged.classes.has(name)) continue;
        const holder = perRef.find((r) => r.cat.classes.has(name));
        if (holder) note(holder.cat.classes.get(name), 'classe', file, (r) => r.cat.classes.has(name));
      }
    }
  }
  return [...missing.values()].map((m) => ({ ...m, files: [...m.files] }));
}

/** Tries Reldor's item-by-item merge on a conflicting metadata XML. */
function xmlConflict(root, file, { mergeBase, target, source }) {
  const show = (ref) => {
    const r = git(root, ['show', `${ref}:${file}`]);
    return r.ok ? r.stdout : '';
  };
  try {
    const r = mergeXml(show(mergeBase), show(target), show(source));
    if (!r.supported) return null;
    return { resolvable: r.conflicts.length === 0, items: r.conflicts, merged: r.merged };
  } catch {
    return null;
  }
}

/**
 * Promotion rehearsal: what happens if `source` is merged into the branch of environment `env`.
 * Nothing in your repository changes.
 */
function rehearse(root, config, { env, source = 'HEAD', quick = false }) {
  const environments = config.environments || [];
  if (!environments.length) throw new Error('Nenhum ambiente configurado. Rode "reldor init" ou preencha environments no reldor.config.yaml.');
  const idx = findEnvironment(environments, env);
  if (idx < 0) throw new Error(`Ambiente "${env}" não encontrado. Ambientes: ${environments.map((e) => e.name).join(', ')}.`);
  const target = environments[idx];
  const targetRef = gitApi.resolveBranch(root, target.branch);
  if (!targetRef) throw new Error(`A branch ${target.branch} não existe aqui. Rode com --fetch ou confira o nome no reldor.config.yaml.`);
  const sourceName = source === 'HEAD' ? gitApi.currentBranch(root) : source;
  const refs = environments.map((e) => ({ name: e.name, ref: gitApi.resolveBranch(root, e.branch) })).filter((r) => r.ref);

  const commits = commitList(root, [`${targetRef}..${source}`]);
  const report = { source: sourceName, env: target.name, branch: target.branch, targetRef, commits, previous: null, notInPrevious: [], foreign: null, conflicts: [], missing: [], method: null };
  if (!commits.length) return report;

  // 1. Order: the pipeline only accepts commits that already went through the previous environment.
  if (idx > 0) {
    const prev = environments[idx - 1];
    const prevRef = gitApi.resolveBranch(root, prev.branch);
    report.previous = prev.name;
    if (prevRef) report.notInPrevious = commitList(root, [`${prevRef}..${source}`, `^${targetRef}`]);
  }

  // 2. Other people's commits going along (usually a merge or pull of develop into the feature branch).
  const me = (git(root, ['config', 'user.email']).stdout || '').toLowerCase();
  const others = me ? commits.filter((c) => String(c.email).toLowerCase() !== me) : [];
  if (others.length) {
    const from = refs.filter((r) => r.ref !== targetRef && others.some((c) => isAncestor(root, c.hash, r.ref))).map((r) => r.name);
    report.foreign = { commits: others, from };
  }

  // 3. Merge simulation and conflicts.
  const mergeBase = git(root, ['merge-base', targetRef, source]).stdout;
  const sim = simulateMerge(root, targetRef, source, { worktree: !quick });
  let mergedFiles;
  if (!sim) {
    // Quick mode on an old Git: no in-memory merge. Conflicts are left for the full rehearsal; the files after the
    // merge are the target's plus what the branch adds, minus what it deletes (good enough for dependencies).
    report.partial = true;
    const added = lines(git(root, ['diff', '--name-only', '--diff-filter=AMR', mergeBase, source]));
    const deleted = new Set(lines(git(root, ['diff', '--name-only', '--diff-filter=D', mergeBase, source])));
    mergedFiles = [...new Set([...lines(git(root, ['ls-tree', '-r', '--name-only', targetRef])), ...added])].filter((f) => !deleted.has(f));
  } else {
    report.method = sim.method;
    mergedFiles = sim.files;
  }
  for (const file of sim ? sim.conflicts : []) {
    const xml = isOrganizable(file) ? xmlConflict(root, file, { mergeBase, target: targetRef, source }) : null;
    report.conflicts.push({ file, kind: xml ? 'metadado' : 'linha', ...(xml || {}) });
  }

  // 4. Dependencies that will be missing in the target after the merge.
  report.missing = missingDependencies(root, { source, mergeBase, mergedFiles, refs: [...refs, { name: `sua branch (${sourceName})`, ref: source }] });

  report.rerere = git(root, ['config', 'rerere.enabled']).stdout === 'true';
  report.driver = Boolean(git(root, ['config', 'merge.reldor.driver']).stdout);
  return report;
}

module.exports = { rehearse, findEnvironment, simulateMerge, missingDependencies, catalog };
