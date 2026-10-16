'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { organizeXml } = require('./organize');
const { isOrganizable } = require('./rules');

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (isOrganizable(full)) out.push(full);
  }
  return out;
}

/**
 * Organizes files. `files` are paths relative to root. With `check`, nothing is written.
 * Returns one entry per file: { file, changed, duplicates, sorted, conflicts, error }.
 */
function organizeFiles(root, files, { check = false } = {}) {
  const results = [];
  for (const rel of files) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full) || !isOrganizable(full)) continue;
    try {
      const original = fs.readFileSync(full, 'utf8');
      const { text, changed, report, supported } = organizeXml(original);
      if (!supported) continue;
      if (changed && !check) fs.writeFileSync(full, text, 'utf8');
      results.push({ file: rel.split(path.sep).join('/'), changed, type: report.type, duplicates: report.duplicates, sorted: report.sorted, conflicts: report.conflicts });
    } catch (error) {
      results.push({ file: rel, changed: false, error: error.message, duplicates: 0, sorted: 0, conflicts: [] });
    }
  }
  return results;
}

function allOrganizable(root, packageDirectories) {
  return packageDirectories.flatMap((d) => walk(path.join(root, d))).map((f) => path.relative(root, f));
}

module.exports = { organizeFiles, allOrganizable, isOrganizable };
