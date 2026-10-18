'use strict';

const fs = require('node:fs');
const path = require('node:path');
const gitApi = require('../../../core/git');
const { tokenize } = require('./tokens');
const { findDuplicateBlocks } = require('./duplicates');
const { findRepetition } = require('./repetition');
const { runAnalyzer } = require('../security/analyzer');

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
    else if (/\.cls$/i.test(e.name)) out.push(full);
  }
  return out;
}

/** Every Apex class of the project, tokenized once. */
function loadSources(root, packageDirectories, model, includeTests = false) {
  const sources = new Map();
  for (const full of packageDirectories.flatMap((d) => walk(path.join(root, d)))) {
    const rel = path.relative(root, full).split(path.sep).join('/');
    const className = path.basename(full, '.cls');
    const cls = model.classes[className];
    const isTest = cls ? cls.isTest : /@isTest/i.test(fs.readFileSync(full, 'utf8'));
    if (isTest && !includeTests) continue;
    const text = fs.readFileSync(full, 'utf8');
    sources.set(rel, { text, className, isTest, isSelector: Boolean(cls && cls.kinds.includes('selector')), ...tokenize(text) });
  }
  return sources;
}

/** Lines added in `file` compared with `base` (working tree included). null means "the whole file is new". */
function addedLines(root, file, base) {
  const tracked = gitApi.git(root, ['ls-files', '--error-unmatch', '--', file]).ok;
  if (!tracked) return null;
  const from = base ? gitApi.git(root, ['merge-base', base, 'HEAD']).stdout || base : 'HEAD';
  const diff = gitApi.git(root, ['diff', '-U0', from, '--', file]);
  if (!diff.ok) return null;
  if (!diff.stdout) return new Set();
  const lines = new Set();
  for (const m of diff.stdout.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    for (let i = 0; i < count; i += 1) lines.add(start + i);
  }
  return lines;
}

const KIND_SEVERITY = { 'bloco-copiado': 'média' };

/**
 * Code quality review. files: changed files (relative). all: review every class as if new.
 * Returns { findings, analyzer } with findings sorted by priority.
 */
function qualityReview(root, files, { model, packageDirectories, base, all = false, analyzer = true, analyzerSelectors = ['Recommended', 'cpd'], options = {} }) {
  const sources = loadSources(root, packageDirectories, model, options.include_tests);
  const changed = new Map();
  for (const f of all ? [...sources.keys()] : files.filter((x) => /\.cls$/i.test(x))) {
    if (!sources.has(f)) continue;
    changed.set(f, all ? null : addedLines(root, f, base));
  }

  const findings = [];
  // One finding per pair of files: a generated class can have hundreds of blocks equal to another file (or itself).
  const pairs = new Map();
  for (const b of findDuplicateBlocks(sources, changed, { minTokens: options.min_tokens, minLines: options.min_lines })) {
    const key = `${b.file}|${b.other}`;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(b);
  }
  for (const blocks of pairs.values()) {
    const b = blocks[0];
    if (blocks.length > 1) {
      const lines = blocks.reduce((n, x) => n + (x.to - x.from + 1), 0);
      const where = b.other === b.file ? 'outros trechos deste mesmo arquivo' : `trechos de ${path.basename(b.other)}`;
      findings.push({
        kind: 'bloco-copiado',
        severity: KIND_SEVERITY['bloco-copiado'],
        file: b.file,
        line: b.from,
        message: `${blocks.length} trechos (${lines} linhas, a partir da linha ${b.from}) são iguais a ${where}.`,
        fix: b.other === b.file ? 'Se o arquivo é gerado (ex.: classe de WSDL), ignore; se não, extraia o trecho repetido para um método.' : 'Se é a mesma classe copiada em outro pacote, deixe uma só e dependa dela; se não, extraia os trechos para um método compartilhado.',
        source: 'reldor',
        blocks: blocks.map((x) => ({ from: x.from, to: x.to, otherFrom: x.otherFrom, otherTo: x.otherTo })),
      });
      continue;
    }
    findings.push({
      kind: 'bloco-copiado',
      severity: KIND_SEVERITY['bloco-copiado'],
      file: b.file,
      line: b.from,
      message: `As linhas ${b.from} a ${b.to} são iguais às linhas ${b.otherFrom} a ${b.otherTo} ${b.other === b.file ? 'deste mesmo arquivo' : `de ${path.basename(b.other)}`}${b.places > 2 ? `, e o mesmo bloco aparece em ${b.places} lugares` : ''}.`,
      fix: 'Extraia o trecho para um método compartilhado (um Service ou uma classe utilitária) e chame dos dois lugares.',
      source: 'reldor',
    });
  }
  for (const r of findRepetition(sources, changed, model, { minLiteralFiles: options.min_literal_files })) findings.push({ ...r, source: 'reldor' });

  let ca = { ran: false, findings: [] };
  if (analyzer) {
    const targets = all ? packageDirectories : files.filter((f) => /\.(cls|trigger|js|html|page|component)$/i.test(f) || /\.flow-meta\.xml$/i.test(f));
    ca = runAnalyzer(root, targets, analyzerSelectors);
  }
  const order = { alta: 0, 'média': 1, baixa: 2 };
  const all_ = [...findings, ...ca.findings.map((f) => ({ ...f, kind: 'code-analyzer' }))].sort((a, b) => order[a.severity] - order[b.severity] || String(a.file).localeCompare(String(b.file)) || (a.line || 0) - (b.line || 0));
  const counts = { alta: 0, 'média': 0, baixa: 0 };
  for (const f of all_) counts[f.severity] += 1;
  return { files: changed.size, findings: all_, counts, analyzer: { ran: ca.ran, note: ca.note || null } };
}

module.exports = { qualityReview, loadSources, addedLines };
