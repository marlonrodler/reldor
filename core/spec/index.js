'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SPEC_FILES = ['requirements.md', 'design.md', 'tasks.md'];
const KNOWN_SPEC_DIRS = ['.kiro/specs'];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** Finds spec folders (Kiro format or any folder with requirements/design/tasks). */
function findSpecs(root, config) {
  const dirs = new Set([config?.spec?.path, ...KNOWN_SPEC_DIRS].filter(Boolean));
  const specs = [];
  for (const rel of dirs) {
    const dir = path.join(root, rel);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const folder = path.join(dir, entry.name);
      const files = SPEC_FILES.filter((f) => fs.existsSync(path.join(folder, f)));
      if (files.length === 0) continue;
      const mtime = Math.max(...files.map((f) => fs.statSync(path.join(folder, f)).mtimeMs));
      specs.push({ name: entry.name, path: path.relative(root, folder), files, updatedAt: new Date(mtime).toISOString() });
    }
  }
  return specs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Picks the spec for the current branch: a spec whose name appears in the branch name
 * (e.g. branch feature/TASK-123-ajuste and spec task-123), otherwise none.
 */
function specForBranch(specs, branch) {
  const b = normalize(branch);
  if (!b) return null;
  return specs.find((s) => {
    const n = normalize(s.name);
    return n.length >= 3 && (b.includes(n) || n.includes(b));
  }) || null;
}

module.exports = { findSpecs, specForBranch, SPEC_FILES };
