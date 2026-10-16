'use strict';

const { run } = require('../util/exec');

function git(root, args) {
  return run('git', args, { cwd: root });
}

function isRepo(root) {
  return git(root, ['rev-parse', '--is-inside-work-tree']).stdout === 'true';
}

function currentBranch(root) {
  const res = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return res.ok ? res.stdout : null;
}

/** Uncommitted changes, grouped by kind. */
function pendingChanges(root) {
  const res = git(root, ['status', '--porcelain']);
  const files = { modified: [], added: [], deleted: [], untracked: [] };
  if (!res.ok || !res.stdout) return files;
  for (const raw of res.stdout.split('\n')) {
    const code = raw.slice(0, 2);
    const file = raw.slice(3);
    if (code === '??') files.untracked.push(file);
    else if (code.includes('D')) files.deleted.push(file);
    else if (code.includes('A')) files.added.push(file);
    else files.modified.push(file);
  }
  return files;
}

function refExists(root, ref) {
  return git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).ok;
}

/** Prefers the remote branch (origin/x), which reflects the shared environment. */
function resolveBranch(root, name) {
  if (!name) return null;
  if (refExists(root, `origin/${name}`)) return `origin/${name}`;
  if (refExists(root, name)) return name;
  return null;
}

/** Lists local and remote branch names (remote ones without the "origin/" prefix). */
function listBranches(root) {
  const res = git(root, ['branch', '-a', '--format=%(refname:short)']);
  if (!res.ok) return [];
  const names = new Set();
  for (const ref of res.stdout.split('\n').filter(Boolean)) {
    if (ref === 'origin/HEAD' || ref === 'origin') continue;
    names.add(ref.startsWith('origin/') ? ref.slice('origin/'.length) : ref);
  }
  return [...names];
}

/**
 * Commits of `head` that are missing from `target`, ignoring commits that already exist in `base`.
 * Returns null when it cannot be computed.
 */
function missingCommits(root, { head = 'HEAD', target, base }) {
  const args = ['rev-list', '--no-merges', head, `^${target}`];
  if (base) args.push(`^${base}`);
  const res = git(root, args);
  if (!res.ok) return null;
  return res.stdout ? res.stdout.split('\n') : [];
}

function fetch(root) {
  return git(root, ['fetch', '--quiet', '--prune']);
}

module.exports = {
  git,
  isRepo,
  currentBranch,
  pendingChanges,
  refExists,
  resolveBranch,
  listBranches,
  missingCommits,
  fetch,
};
