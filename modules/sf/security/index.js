'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { scanFile, isScannable } = require('./rules');
const { pathFindings } = require('./flow');
const { runAnalyzer } = require('./analyzer');

const ORDER = { alta: 0, 'média': 1, baixa: 2 };

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === '__tests__') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (isScannable(full)) out.push(full);
  }
  return out;
}

/**
 * Security review of the given files (paths relative to root).
 * options: { model, sensitiveTerms, strictSharing, analyzer: boolean }
 */
function securityReview(root, files, options = {}) {
  const findings = [];
  for (const rel of files) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full) || !isScannable(rel)) continue;
    findings.push(...scanFile(rel.split(path.sep).join('/'), fs.readFileSync(full, 'utf8'), options));
  }
  if (options.model) {
    const classNames = files.filter((f) => f.endsWith('.cls')).map((f) => path.basename(f, '.cls'));
    findings.push(...pathFindings(options.model, classNames));
  }
  let analyzer = { ran: false, findings: [] };
  if (options.analyzer !== false) analyzer = runAnalyzer(root, files.filter((f) => isScannable(f)));
  const all = [...findings, ...analyzer.findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || String(a.file).localeCompare(String(b.file)) || (a.line || 0) - (b.line || 0));
  const counts = { alta: 0, 'média': 0, baixa: 0 };
  for (const f of all) counts[f.severity] += 1;
  return { files: files.length, findings: all, counts, analyzer: { ran: analyzer.ran, note: analyzer.note || null } };
}

function allScannable(root, packageDirectories) {
  return packageDirectories.flatMap((d) => walk(path.join(root, d))).map((f) => path.relative(root, f).split(path.sep).join('/'));
}

module.exports = { securityReview, allScannable, isScannable };
