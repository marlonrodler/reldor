'use strict';

const gitApi = require('../../../core/git');
const { isOrganizable } = require('../xml/rules');

const git = (root, args) => gitApi.git(root, args);
const lines = (r) => (r.ok && r.stdout ? r.stdout.split('\n').filter(Boolean) : []);

/** Old-side line ranges touched by a diff of one file: [[start, end], ...]. */
function hunks(root, from, to, file) {
  const out = [];
  for (const m of git(root, ['diff', '-U0', from, to, '--', file]).stdout.matchAll(/^@@ -(\d+)(?:,(\d+))? /gm)) {
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    out.push([start, start + Math.max(count, 1) - 1]);
  }
  return out;
}

const overlaps = (a, b) => a.some(([s1, e1]) => b.some(([s2, e2]) => s1 <= e2 + 2 && s2 <= e1 + 2));

/**
 * Collision radar: other open branches that change the same files as yours.
 * base: the production branch (where feature branches start). Only branches with commits in the last `days`.
 */
function findCollisions(root, { base, environments = [], days = 30, source = 'HEAD' }) {
  const me = git(root, ['rev-parse', source]).stdout;
  const myBase = git(root, ['merge-base', base, source]).stdout;
  const mine = new Set([
    ...lines(git(root, ['diff', '--name-only', myBase, source])),
    ...(source === 'HEAD' ? lines(git(root, ['diff', '--name-only', 'HEAD'])) : []),
  ]);
  const report = { base, files: mine.size, branches: 0, collisions: [] };
  if (!mine.size) return report;

  const envBranches = new Set(environments.map((e) => e.branch));
  const current = gitApi.currentBranch(root);
  const since = Date.now() / 1000 - days * 86400;
  const seen = new Set();
  const refs = lines(git(root, ['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)%09%(committerdate:unix)%09%(authorname)', 'refs/remotes/origin', 'refs/heads']));
  for (const row of refs) {
    const [ref, when, author] = row.split('\t');
    const name = ref.replace(/^origin\//, '');
    if (Number(when) < since) break;
    if (name === 'HEAD' || ref === 'origin' || envBranches.has(name) || name === current || seen.has(name)) continue;
    seen.add(name);
    const tip = git(root, ['rev-parse', ref]).stdout;
    if (!tip || tip === me) continue;
    const theirBase = git(root, ['merge-base', base, ref]).stdout;
    if (theirBase === tip) continue; // nothing beyond production: merged or empty
    if (git(root, ['merge-base', '--is-ancestor', tip, source]).code === 0) continue; // already inside your branch
    report.branches += 1;
    const theirs = lines(git(root, ['diff', '--name-only', theirBase, ref]));
    const shared = theirs.filter((f) => mine.has(f));
    if (!shared.length) continue;
    const reached = environments.filter((e) => {
      const r = gitApi.resolveBranch(root, e.branch);
      return r && git(root, ['merge-base', '--is-ancestor', tip, r]).code === 0;
    }).map((e) => e.name);
    const files = shared.map((file) => {
      if (isOrganizable(file)) return { file, risk: 'baixo', why: 'metadado juntado item a item pelo merge inteligente' };
      const same = myBase === theirBase && overlaps(hunks(root, myBase, source, file), hunks(root, theirBase, ref, file));
      return same ? { file, risk: 'alto', why: 'as mesmas linhas foram mudadas nas duas branches' } : { file, risk: 'médio', why: 'mesmo arquivo, partes diferentes' };
    });
    report.collisions.push({ branch: name, author, date: new Date(Number(when) * 1000).toISOString().slice(0, 10), reached, files });
  }
  const order = { alto: 0, 'médio': 1, baixo: 2 };
  const worst = (c) => Math.min(...c.files.map((f) => order[f.risk]));
  report.collisions.sort((a, b) => worst(a) - worst(b));
  return report;
}

module.exports = { findCollisions };
