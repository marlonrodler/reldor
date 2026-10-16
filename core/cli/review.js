'use strict';

const { loadConfig } = require('../config');
const { logAction } = require('../log');
const { print, printJson } = require('../report');

/**
 * reldor review: everything that should be checked before a commit, in one run and one summary.
 * Security, quality and repeated code, fields read outside the query, tests the change can break, XML out of
 * order and files that came from the org. The detailed commands still exist; this is the one people use.
 */
function review(root, flags) {
  const { buildIndex } = require('../../modules/sf/indexer');
  const { readProject } = require('../../modules/sf');
  const security = require('../../modules/sf/security');
  const quality = require('../../modules/sf/quality');
  const { checkQueries } = require('../../modules/sf/checks/queries');
  const { buildRadar } = require('../../modules/sf/test-radar');
  const { changedFiles, defaultBase } = require('../../modules/sf/test-radar/changes');
  const xml = require('../../modules/sf/xml');
  const snapshotApi = require('../git/snapshot');

  const { config } = loadConfig(root);
  const project = readProject(root) || { packageDirectories: ['force-app'] };
  const changes = changedFiles(root, config, { base: flags.base });
  const files = changes.filter((c) => c.status !== 'deleted').map((c) => c.file);
  const { model } = buildIndex(root, { full: Boolean(flags.full) });
  const analyzer = !flags['no-analyzer'];

  // One Code Analyzer run for security and quality rules.
  const q = quality.qualityReview(root, files, {
    model,
    packageDirectories: project.packageDirectories,
    base: flags.base || defaultBase(root, config),
    analyzer,
    analyzerSelectors: ['Recommended', 'Security', 'cpd'],
    options: config.quality || {},
  });
  const isSecurityRule = (f) => f.kind === 'code-analyzer' && (f.tags || []).some((t) => /security/i.test(t));
  const s = security.securityReview(root, files.filter((f) => security.isScannable(f)), {
    model,
    sensitiveTerms: config.security?.sensitive_terms,
    strictSharing: Boolean(config.security?.strict_sharing),
    analyzer: false,
  });
  s.findings.push(...q.findings.filter(isSecurityRule));
  const qualityFindings = q.findings.filter((f) => !isSecurityRule(f));
  const radar = buildRadar(model, changes);
  const queries = radar.classes.length ? checkQueries(model, radar.classes) : [];
  const xmlResults = xml.organizeFiles(root, files.filter((f) => xml.isOrganizable(f)), { check: true });
  const snapshot = snapshotApi.loadSnapshot(root);
  const plan = snapshot ? snapshotApi.planCleanCommit(root, snapshot, []) : null;

  const blocking = [];
  const attention = [];
  for (const f of s.findings) (f.severity === 'alta' ? blocking : attention).push({ area: 'segurança', file: f.file, line: f.line, text: f.message, fix: f.fix });
  for (const i of queries) blocking.push({ area: 'query', file: i.class, text: `${i.object}.${i.field} é lido mas não está na SOQL/Selector (${i.certainty}): erro em produção`, fix: 'Inclua o campo na query ou no Selector.' });
  for (const f of qualityFindings) if (f.severity !== 'baixa') attention.push({ area: 'qualidade', file: f.file, line: f.line, text: f.message, fix: f.fix });
  for (const r of xmlResults) {
    if (r.conflicts.length) blocking.push({ area: 'xml', file: r.file, text: `item duplicado com valores diferentes: ${r.conflicts.map((c) => `${c.section} ${c.key}`).join(', ')}`, fix: 'Decida qual valor fica e apague o outro.' });
    else if (r.changed) attention.push({ area: 'xml', file: r.file, text: 'fora de ordem ou com duplicados', fix: 'reldor xml organiza.' });
  }
  if (plan && (plan.fromOrg.length || plan.mixed.length)) {
    attention.push({ area: 'org', file: null, text: `${plan.fromOrg.length + plan.mixed.length} arquivo(s) têm mudanças que vieram da org e não são suas`, fix: 'reldor clean deixa na pasta só o seu antes do commit.' });
  }
  const low = qualityFindings.filter((f) => f.severity === 'baixa').length;
  return {
    files: files.length,
    blocking,
    attention,
    low,
    tests: radar.tests,
    analyzer: { ran: q.analyzer.ran, note: q.analyzer.note },
    details: { security: s, quality: { ...q, findings: qualityFindings }, queries, xml: xmlResults, org: plan },
  };
}

function render(r) {
  const out = [`\n🛡️  Revisão antes do commit · ${r.files} arquivo(s)`];
  if (!r.files) {
    out.push('', 'Nenhuma mudança encontrada nesta branch.');
    return out;
  }
  const show = (list, max = 8) => {
    for (const x of list.slice(0, max)) {
      out.push(`   • [${x.area}] ${x.file ? `${x.file.split('/').pop()}${x.line ? `:${x.line}` : ''} — ` : ''}${x.text}`);
      if (x.fix) out.push(`     ➜ ${x.fix}`);
    }
    if (list.length > max) out.push(`   … e mais ${list.length - max}`);
  };
  if (r.blocking.length) {
    out.push('', `🔴 Corrija antes do commit (${r.blocking.length}):`);
    show(r.blocking);
  }
  if (r.attention.length) {
    out.push('', `🟡 Atenção (${r.attention.length}):`);
    show(r.attention);
  }
  if (!r.blocking.length && !r.attention.length) out.push('', '✅ Nada para corrigir: segurança, qualidade, queries e XML ok.');
  if (r.low) out.push(`ℹ️  ${r.low} sugestão(ões) de qualidade de baixa prioridade (veja com --json).`);
  const high = r.tests.filter((t) => t.priority === 'alta');
  if (r.tests.length) {
    out.push('', `🧪 Testes que a mudança pode quebrar (${r.tests.length}): ${r.tests.slice(0, 6).map((t) => t.name).join(', ')}${r.tests.length > 6 ? '…' : ''}`);
    out.push(`   ➜ Para rodar na sandbox, sem salvar nada: reldor test-radar --run --org <alias>${high.length ? ` (${high.length} de prioridade alta)` : ''}`);
  }
  out.push('', r.analyzer.ran ? '✅ Regras do Salesforce Code Analyzer (PMD, CPD e segurança) incluídas.' : `ℹ️  ${r.analyzer.note || 'Code Analyzer não executado (--no-analyzer).'}`);
  return out;
}

function reviewCommand(root, flags) {
  const fs = require('node:fs');
  const path = require('node:path');
  if (!fs.existsSync(path.join(root, 'sfdx-project.json'))) {
    print('⚠️ Esta pasta não é um projeto Salesforce (sfdx-project.json não encontrado).');
    return 1;
  }
  const r = review(root, flags);
  logAction(root, 'review', { summary: `${r.files} arquivo(s): ${r.blocking.length} para corrigir, ${r.attention.length} de atenção, ${r.tests.length} teste(s)` });
  if (flags.json) printJson(r);
  else print(render(r));
  if (flags['fail-on'] === 'alta' && r.blocking.length) return 1;
  if (flags['fail-on'] === 'média' && (r.blocking.length || r.attention.length)) return 1;
  return 0;
}

module.exports = { reviewCommand, review };
