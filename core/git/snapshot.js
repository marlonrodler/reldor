'use strict';

/**
 * Snapshot ("foto") of the working tree right after a retrieve, kept as a Git commit object under
 * refs/reldor/snapshot. The clean commit takes only what changed AFTER the snapshot, so what the retrieve
 * brought from the org stays out of the commit. Nothing here touches the user's index or files.
 */
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('../util/exec');
const { paths } = require('../config');

const REF = 'refs/reldor/snapshot';

function git(root, args, options = {}) {
  return run('git', args, { cwd: root, ...options });
}

function gitDir(root) {
  const res = git(root, ['rev-parse', '--git-dir']);
  return path.resolve(root, res.stdout || '.git');
}

/** Tree of the whole working tree (tracked + untracked, respecting .gitignore), via a temporary index. */
function workingTree(root) {
  const index = path.join(gitDir(root), 'reldor-tmp-index');
  const env = { GIT_INDEX_FILE: index };
  try {
    const head = git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']);
    git(root, head.ok ? ['read-tree', 'HEAD'] : ['read-tree', '--empty'], { env });
    const add = git(root, ['add', '-A'], { env });
    if (!add.ok) throw new Error(add.stderr);
    git(root, ['rm', '-r', '-q', '--cached', '--ignore-unmatch', '--', '.reldor/work', '.reldor/cache', '.reldor/log'], { env });
    const tree = git(root, ['write-tree'], { env });
    if (!tree.ok) throw new Error(tree.stderr);
    return tree.stdout;
  } finally {
    fs.rmSync(index, { force: true });
  }
}

function infoFile(root) {
  return path.join(paths(root).work, 'snapshot.json');
}

/** Takes a snapshot of the current working tree. */
function takeSnapshot(root, reason = 'retrieve') {
  const tree = workingTree(root);
  const head = git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']).stdout || null;
  const commit = git(root, ['commit-tree', tree, ...(head ? ['-p', head] : []), '-m', `reldor snapshot (${reason})`], {
    env: { GIT_AUTHOR_NAME: 'Reldor', GIT_AUTHOR_EMAIL: 'reldor@localhost', GIT_COMMITTER_NAME: 'Reldor', GIT_COMMITTER_EMAIL: 'reldor@localhost' },
  });
  if (!commit.ok) throw new Error(commit.stderr);
  git(root, ['update-ref', REF, commit.stdout]);
  const info = { tree, commit: commit.stdout, head, reason, at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(infoFile(root)), { recursive: true });
  fs.writeFileSync(infoFile(root), JSON.stringify(info, null, 2));
  return info;
}

function loadSnapshot(root) {
  try {
    const info = JSON.parse(fs.readFileSync(infoFile(root), 'utf8'));
    return git(root, ['cat-file', '-e', `${info.tree}^{tree}`]).ok ? info : null;
  } catch {
    return null;
  }
}

function clearSnapshot(root) {
  git(root, ['update-ref', '-d', REF]);
  fs.rmSync(infoFile(root), { force: true });
}

function nameStatus(root, from, to) {
  const res = git(root, ['diff', '--name-status', '--no-renames', from, to]);
  if (!res.ok || !res.stdout) return [];
  return res.stdout.split('\n').map((line) => {
    const [code, file] = line.split('\t');
    return { file, status: code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified' };
  });
}

/**
 * What a clean commit would contain.
 * mine: changed after the snapshot · fromOrg: changed only by the retrieve · mixed: both (only your lines go in).
 */
function planCleanCommit(root, snapshot, include = []) {
  const now = workingTree(root);
  const head = git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']).stdout || '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  const byOrg = new Map(nameStatus(root, head, snapshot.tree).map((c) => [c.file, c]));
  const byMe = nameStatus(root, snapshot.tree, now);
  const included = new Set(include.map((f) => f.split(path.sep).join('/')));
  const mine = byMe.filter((c) => !byOrg.has(c.file)).map((c) => c.file);
  const mixed = byMe.filter((c) => byOrg.has(c.file)).map((c) => c.file);
  const fromOrg = [...byOrg.keys()].filter((f) => !mixed.includes(f) && !included.has(f));
  const whole = [...byOrg.keys()].filter((f) => included.has(f));
  return { now, head, mine, mixed, fromOrg, whole };
}

/**
 * Only your lines as one patch file, for the person to apply with `git apply --cached`: only your lines, without
 * Reldor touching the Git index. Each file is checked on a throwaway index first, so the
 * files whose lines touch the org's lines are reported before anything is run. Returns { file, staged, failed }.
 */
function writeCleanPatch(root, snapshot, plan, file) {
  const index = path.join(gitDir(root), 'reldor-check-index');
  const env = { GIT_INDEX_FILE: index };
  const staged = [];
  const failed = [];
  let text = '';
  try {
    git(root, ['read-tree', plan.head], { env });
    const add = (from, files) => {
      for (const f of files) {
        const patch = git(root, ['diff', '--binary', '--full-index', '--no-renames', from, plan.now, '--', f], { raw: true });
        if (!patch.stdout) continue;
        const res = git(root, ['apply', '--cached', '--3way', '--whitespace=nowarn', '-'], { input: patch.stdout, env });
        if (res.ok) {
          staged.push(f);
          text += patch.stdout;
        } else failed.push(f);
      }
    };
    add(snapshot.tree, [...plan.mine, ...plan.mixed]);
    add(plan.head, plan.whole);
  } finally {
    fs.rmSync(index, { force: true });
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return { file, staged, failed };
}

/** After the commit, move the snapshot forward so the committed lines don't show up again. */
function advanceSnapshot(root, snapshot, plan, failed) {
  const index = path.join(gitDir(root), 'reldor-tmp-index');
  const env = { GIT_INDEX_FILE: index };
  try {
    git(root, ['read-tree', plan.now], { env });
    for (const file of failed) {
      const entry = git(root, ['ls-tree', snapshot.tree, '--', file]).stdout;
      if (entry) git(root, ['update-index', '--index-info'], { env, input: `${entry}\n` });
      else git(root, ['update-index', '--force-remove', '--', file], { env });
    }
    const tree = git(root, ['write-tree'], { env }).stdout;
    const head = git(root, ['rev-parse', 'HEAD']).stdout;
    const commit = git(root, ['commit-tree', tree, '-p', head, '-m', 'reldor snapshot (after commit)'], {
      env: { GIT_AUTHOR_NAME: 'Reldor', GIT_AUTHOR_EMAIL: 'reldor@localhost', GIT_COMMITTER_NAME: 'Reldor', GIT_COMMITTER_EMAIL: 'reldor@localhost' },
    }).stdout;
    git(root, ['update-ref', REF, commit]);
    const info = { ...snapshot, tree, commit, head, reason: 'after commit', at: new Date().toISOString() };
    fs.writeFileSync(infoFile(root), JSON.stringify(info, null, 2));
    return info;
  } finally {
    fs.rmSync(index, { force: true });
  }
}

module.exports = { takeSnapshot, loadSnapshot, clearSnapshot, planCleanCommit, writeCleanPatch, advanceSnapshot, workingTree, REF };
