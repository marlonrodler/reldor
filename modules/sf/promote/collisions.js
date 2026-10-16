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

/** Open pull requests from GitHub (gh CLI), or null when gh is missing, not logged in or offline. */
function openPullRequests(root) {
  const { run } = require('../../../core/util/exec');
  const r = run('gh', ['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'number,headRefName,baseRefName,author,url,title'], { cwd: root, timeout: 20000 });
  if (!r.ok) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

function sharedFiles(root, { mine, myBase, source, from, to }) {
  const theirs = lines(git(root, ['diff', '--name-only', from, to]));
  return theirs.filter((f) => mine.has(f)).map((file) => {
    if (isOrganizable(file)) return { file, risk: 'baixo', why: 'metadado juntado item a item pelo merge inteligente' };
    const same = myBase === from && overlaps(hunks(root, myBase, source, file), hunks(root, from, to, file));
    return same ? { file, risk: 'alto', why: 'as mesmas linhas foram mudadas nas duas branches' } : { file, risk: 'médio', why: 'mesmo arquivo, partes diferentes' };
  });
}

/**
 * Collision radar: other work that changes the same files as yours.
 * By default only work that is moving forward counts: an open pull request (GitHub, through gh) or a branch that
 * already reached an environment. Abandoned or early branches are ignored unless all = true.
 */
function findCollisions(root, { base, environments = [], days = 30, source = 'HEAD', all = false, pullRequests }) {
  const me = git(root, ['rev-parse', source]).stdout;
  const myBase = git(root, ['merge-base', base, source]).stdout;
  const mine = new Set([
    ...lines(git(root, ['diff', '--name-only', myBase, source])),
    ...(source === 'HEAD' ? lines(git(root, ['diff', '--name-only', 'HEAD'])) : []),
  ]);
  const prs = pullRequests === undefined ? openPullRequests(root) : pullRequests;
  const report = { base, files: mine.size, branches: 0, ignored: 0, pullRequests: prs ? prs.length : null, collisions: [] };
  if (!mine.size) return report;

  const envRefs = environments.map((e) => ({ name: e.name, branch: e.branch, ref: gitApi.resolveBranch(root, e.branch) })).filter((e) => e.ref);
  const preProduction = envRefs.filter((e) => e.ref !== base);
  const envBranches = new Set(environments.map((e) => e.branch));
  const current = gitApi.currentBranch(root);
  const isAncestor = (a, b) => git(root, ['merge-base', '--is-ancestor', a, b]).code === 0;
  const done = new Set();

  // 1. Open pull requests: what the PR adds on top of its target branch (works for merge branches too).
  for (const pr of prs || []) {
    const head = gitApi.resolveBranch(root, pr.headRefName);
    const target = gitApi.resolveBranch(root, pr.baseRefName);
    done.add(pr.headRefName);
    if (!head || !target || isAncestor(me, head) || pr.headRefName === current) continue;
    report.branches += 1;
    const from = git(root, ['merge-base', target, head]).stdout;
    const files = sharedFiles(root, { mine, myBase, source, from, to: head });
    if (files.length) report.collisions.push({ branch: pr.headRefName, author: pr.author?.login || pr.author?.name || '', pr: { number: pr.number, url: pr.url, base: pr.baseRefName, title: pr.title }, reached: [], files });
  }

  // 2. Branches. Merge branches (that contain an environment) are skipped: their PR is what matters.
  const since = Date.now() / 1000 - days * 86400;
  const refs = lines(git(root, ['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)%09%(committerdate:unix)%09%(authorname)', 'refs/remotes/origin', 'refs/heads']));
  for (const row of refs) {
    const [ref, when, author] = row.split('\t');
    const name = ref.replace(/^origin\//, '');
    if (Number(when) < since) break;
    if (name === 'HEAD' || ref === 'origin' || envBranches.has(name) || name === current || done.has(name)) continue;
    done.add(name);
    const tip = git(root, ['rev-parse', ref]).stdout;
    if (!tip || tip === me) continue;
    const theirBase = git(root, ['merge-base', base, ref]).stdout;
    if (theirBase === tip || isAncestor(tip, source)) continue;
    // A merge branch, or a branch that pulled an environment (one that has work beyond production): its PR is what matters.
    if (preProduction.some((e) => isAncestor(e.ref, tip) && !isAncestor(e.ref, base))) continue;
    const reached = envRefs.filter((e) => isAncestor(tip, e.ref)).map((e) => e.name);
    if (!all && !reached.length) {
      report.ignored += 1;
      continue;
    }
    report.branches += 1;
    const files = sharedFiles(root, { mine, myBase, source, from: theirBase, to: ref });
    if (files.length) report.collisions.push({ branch: name, author, date: new Date(Number(when) * 1000).toISOString().slice(0, 10), reached, files });
  }
  const order = { alto: 0, 'médio': 1, baixo: 2 };
  const worst = (c) => Math.min(...c.files.map((f) => order[f.risk]));
  report.collisions.sort((a, b) => worst(a) - worst(b));
  return report;
}

module.exports = { findCollisions, openPullRequests };
