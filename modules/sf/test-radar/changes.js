'use strict';

const path = require('node:path');
const gitApi = require('../../../core/git');
const { classify } = require('../indexer/parsers');

/** The branch the feature is compared against: production env, then usual names. */
function defaultBase(root, config) {
  const envs = config.environments || [];
  const candidates = [envs.length ? envs[envs.length - 1].branch : null, 'master', 'main'].filter(Boolean);
  for (const name of candidates) {
    const ref = gitApi.resolveBranch(root, name);
    if (ref) return ref;
  }
  return null;
}

/**
 * Files changed by this feature: commits since the merge base with `base`, plus what is not committed yet.
 * Each entry: { file, status: 'added' | 'modified' | 'deleted', meta } where meta is the metadata kind or null.
 */
function changedFiles(root, config, options = {}) {
  const files = new Map();
  const put = (file, status) => {
    if (!file) return;
    const norm = file.split(path.sep).join('/');
    if (!files.has(norm) || status === 'deleted') files.set(norm, status);
  };

  if (options.files) {
    for (const f of String(options.files).split(',').map((s) => s.trim()).filter(Boolean)) put(f, 'modified');
  } else {
    const base = options.base || defaultBase(root, config);
    if (base) {
      const res = gitApi.git(root, ['diff', '--name-status', `${base}...HEAD`]);
      if (res.ok && res.stdout) {
        for (const line of res.stdout.split('\n')) {
          const [code, ...rest] = line.split('\t');
          const file = rest[rest.length - 1];
          put(file, code.startsWith('D') ? 'deleted' : code.startsWith('A') ? 'added' : 'modified');
        }
      }
    }
    const pending = gitApi.pendingChanges(root);
    for (const f of pending.modified) put(f, 'modified');
    for (const f of [...pending.added, ...pending.untracked]) put(f, 'added');
    for (const f of pending.deleted) put(f, 'deleted');
  }

  return [...files.entries()]
    .map(([file, status]) => ({ file, status, meta: classify(file) }))
    .filter((c) => c.meta);
}

module.exports = { changedFiles, defaultBase };
