'use strict';

/** Salesforce Code Analyzer (sf code-analyzer) on the given files, with the given rule selectors. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runSf } = require('../org/sf');

const SEVERITY = { 1: 'alta', 2: 'alta', 3: 'média', 4: 'baixa', 5: 'baixa' };

function available(root) {
  return runSf(['code-analyzer', 'run', '--help'], { cwd: root, timeout: 60000 }).ok;
}

function runAnalyzer(root, files, selectors = ['Security']) {
  if (!files.length) return { ran: false, findings: [] };
  if (!available(root)) return { ran: false, findings: [], note: 'Salesforce Code Analyzer não instalado. Para somar as regras oficiais: sf plugins install code-analyzer' };
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-ca-')), 'results.json');
  const args = ['code-analyzer', 'run', ...selectors.flatMap((s) => ['--rule-selector', s]), '--workspace', '.', ...files.flatMap((f) => ['--target', f]), '--output-file', out];
  const res = runSf(args, { cwd: root, timeout: 20 * 60000 });
  let json = null;
  try {
    json = JSON.parse(fs.readFileSync(out, 'utf8'));
  } catch {
    return { ran: false, findings: [], note: `O Code Analyzer não gerou resultado: ${(res.stderr || res.stdout).split('\n').slice(-3).join(' ')}` };
  }
  const findings = (json.violations || []).map((v) => {
    const loc = (v.locations || [])[v.primaryLocationIndex || 0] || {};
    return {
      rule: `${v.engine}:${v.rule}`,
      severity: SEVERITY[v.severity] || 'média',
      file: loc.file ? path.relative(root, path.resolve(root, loc.file)).split(path.sep).join('/') : null,
      line: loc.startLine || null,
      message: v.message,
      fix: (v.resources || [])[0] || null,
      tags: v.tags || [],
      source: 'code-analyzer',
    };
  });
  return { ran: true, findings };
}

module.exports = { runAnalyzer, available };
