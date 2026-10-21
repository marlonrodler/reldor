'use strict';

/**
 * Specs of any tool. Known places are looked at first (Kiro, Spec Kit, OpenSpec, docs/specs); any other folder with
 * spec files is found by a bounded walk. Nothing about one company: the project can add its own place (spec.path).
 */
const fs = require('node:fs');
const path = require('node:path');

const SPEC_FILES = ['requirements.md', 'design.md', 'tasks.md', 'spec.md', 'plan.md', 'proposal.md'];
const KNOWN_SPEC_DIRS = [
  { dir: '.kiro/specs', tool: 'Kiro' },
  { dir: 'specs', tool: 'Spec Kit' },
  { dir: '.specify/specs', tool: 'Spec Kit' },
  { dir: 'openspec/changes', tool: 'OpenSpec' },
  { dir: 'openspec/specs', tool: 'OpenSpec' },
  { dir: 'docs/specs', tool: 'pasta de specs' },
];
const SKIP = new Set(['node_modules', '.git', '.sfdx', '.sf', '.reldor', 'force-app', 'unpackaged', 'dist', 'coverage', '.vscode']);

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** One spec folder: name, path, tool, files and last change. */
function specAt(root, folder, tool) {
  const files = SPEC_FILES.filter((f) => fs.existsSync(path.join(folder, f)));
  if (!files.length) return null;
  const mtime = Math.max(...files.map((f) => fs.statSync(path.join(folder, f)).mtimeMs));
  return { name: path.basename(folder), path: path.relative(root, folder).split(path.sep).join('/'), tool, files, updatedAt: new Date(mtime).toISOString() };
}

/** Folders with spec files anywhere in the project (depth 4), outside the known places and the metadata folders. */
function scanSpecs(root, known, depth = 4) {
  const out = [];
  const walk = (dir, level) => {
    if (level > depth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (known.some((k) => rel === k || rel.startsWith(`${k}/`))) continue;
      const spec = specAt(root, full, 'pasta do projeto');
      if (spec && spec.files.some((f) => f !== 'plan.md')) out.push(spec);
      else walk(full, level + 1);
    }
  };
  walk(root, 0);
  return out;
}

/** Finds spec folders of every known tool, the project's own place and, with `scan`, anywhere else. */
function findSpecs(root, config, { scan = false } = {}) {
  const own = config?.spec?.path;
  const places = [...(own ? [{ dir: own, tool: (KNOWN_SPEC_DIRS.find((k) => k.dir === own) || {}).tool || 'pasta do projeto' }] : []), ...KNOWN_SPEC_DIRS];
  const specs = [];
  const seen = new Set();
  for (const { dir: rel, tool } of places) {
    const dir = path.join(root, rel);
    if (seen.has(rel) || !fs.existsSync(dir)) continue;
    seen.add(rel);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const spec = specAt(root, path.join(dir, entry.name), tool);
      if (spec) specs.push(spec);
    }
  }
  if (scan) specs.push(...scanSpecs(root, [...seen]));
  return specs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * The spec of a task: its folder name has the task id as a whole token ("1234-ajuste", "ABC-123_x"), or the folder
 * name appears in the branch name.
 */
function specsForTask(specs, id, branch) {
  if (id) {
    const token = new RegExp(`(^|[^A-Za-z0-9])${String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^0-9])`, 'i');
    const hits = specs.filter((s) => token.test(s.name) || token.test(s.path));
    if (hits.length) return hits;
  }
  const b = normalize(branch);
  return b ? specs.filter((s) => {
    const n = normalize(s.name);
    return n.length >= 3 && (b.includes(n) || n.includes(b));
  }) : [];
}

/** Kept for older callers: the first spec of the branch. */
function specForBranch(specs, branch, id) {
  return specsForTask(specs, id, branch)[0] || null;
}

module.exports = { findSpecs, specsForTask, specForBranch, SPEC_FILES, KNOWN_SPEC_DIRS };
