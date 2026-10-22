'use strict';

const { loadConfig } = require('../config');
const { logAction } = require('../log');
const { print, printJson } = require('../report');

/**
 * reldor review: everything that should be checked before a commit, in one run and one summary.
 * Security, quality and repeated code, fields read outside the query, tests the change can break, XML out of
 * order and files that came from the org. The detailed commands still exist; this is the one people use.
 * Each part follows tools: in the config (a part another tool takes care of is only checked, or left out and listed),
 * and the run ledger (the same check over the same content is reused, never run twice).
 */
function review(root, flags) {
  const { buildIndex } = require('../../modules/sf/indexer');
  const { readProject } = require('../../modules/sf');
  const security = require('../../modules/sf/security');
  const { changedFiles, defaultBase } = require('../../modules/sf/test-radar/changes');
  const xml = require('../../modules/sf/xml');
  const snapshotApi = require('../git/snapshot');
  const tools = require('../tools');

  const { config } = loadConfig(root);
  const project = readProject(root) || { packageDirectories: ['force-app'] };
  const changes = changedFiles(root, config, { base: flags.base });
  const files = changes.filter((c) => c.status !== 'deleted').map((c) => c.file);
  const { model } = buildIndex(root, { full: Boolean(flags.full) });
  const base = flags.base || defaultBase(root, config);
  const shared = require('./checks');
  const reused = [];
  const take = (name, r) => {
    if (r.reused) reused.push(name);
    return r.result;
  };
  const on = (id) => tools.checks(config, id);
  const analyzer = !flags['no-analyzer'] && tools.runs(config, 'code-analyzer');

  // One Code Analyzer run for security and quality rules; the Reldor quality rules only when quality is on.
  const q = on('quality') || analyzer
    ? take('quality', shared.qualityRun(root, files, model, config, { packageDirectories: project.packageDirectories, base, rules: on('quality'), analyzer, analyzerSelectors: ['Recommended', 'Security', 'cpd'] }))
    : { findings: [], analyzer: { ran: false, note: null } };
  if (q.analyzer && q.analyzer.reused) reused.push('code-analyzer');
  const isSecurityRule = (f) => f.kind === 'code-analyzer' && (f.tags || []).some((t) => /security/i.test(t));
  const s = on('security') ? take('security', shared.securityRules(root, files.filter((f) => security.isScannable(f)), model, config)) : { findings: [] };
  s.findings = [...s.findings, ...q.findings.filter(isSecurityRule)];
  const qualityFindings = q.findings.filter((f) => !isSecurityRule(f));
  const radar = on('affected-tests') || on('queries') ? take('affected-tests', shared.radarRun(root, changes, model)) : { tests: [], classes: [] };
  const tests = on('affected-tests') ? radar.tests : [];
  const queries = on('queries') && radar.classes.length ? take('queries', shared.queriesRun(root, radar.classes, model)) : [];
  const xmlDup = on('xml-duplicates');
  const xmlOrder = on('xml-order');
  const xmlResults = xmlDup || xmlOrder ? xml.organizeFiles(root, files.filter((f) => xml.isOrganizable(f)), { check: true }) : [];
  if (xmlResults.some((r) => r.reused)) reused.push('xml-check');
  const snapshot = on('org-files') ? snapshotApi.loadSnapshot(root) : null;
  const plan = snapshot ? snapshotApi.planCleanCommit(root, snapshot, []) : null;

  const blocking = [];
  const attention = [];
  for (const f of s.findings) (f.severity === 'alta' ? blocking : attention).push({ area: 'segurança', file: f.file, line: f.line, text: f.message, fix: f.fix });
  for (const i of queries) blocking.push({ area: 'query', file: i.class, text: `${i.object}.${i.field} é lido mas não está na SOQL/Selector (${i.certainty}): erro em produção`, fix: 'Inclua o campo na query ou no Selector.' });
  for (const f of qualityFindings) if (f.severity !== 'baixa') attention.push({ area: 'qualidade', file: f.file, line: f.line, text: f.message, fix: f.fix });
  for (const r of xmlResults) {
    // A conflict (same item, different values) is never fixed by a tool: it always needs a decision.
    if (r.conflicts.length && xmlDup) blocking.push({ area: 'xml', file: r.file, text: `item duplicado com valores diferentes: ${r.conflicts.map((c) => `${c.section} ${c.key}`).join(', ')}`, fix: 'Decida qual valor fica e apague o outro.' });
    const dup = xmlDup && r.duplicates;
    const order = xmlOrder && r.sorted;
    if (!r.conflicts.length && (dup || order)) {
      const id = dup ? 'xml-duplicates' : 'xml-order';
      attention.push({ area: 'xml', file: r.file, text: [dup && 'com duplicados', order && 'fora de ordem'].filter(Boolean).join(' e '), fix: tools.fixHint(config, id, 'reldor xml organiza.') });
    }
  }
  if (plan && (plan.fromOrg.length || plan.mixed.length)) {
    attention.push({ area: 'org', file: null, text: `${plan.fromOrg.length + plan.mixed.length} arquivo(s) têm mudanças que vieram da org e não são suas`, fix: tools.fixHint(config, 'org-files', 'reldor clean deixa na pasta só o seu antes do commit.') });
  }
  // A file that already existed and was changed without coming fresh from the org first (reldor retrieve --files).
  if (on('retrieve-first')) {
    const stale = require('../../modules/sf/org/fresh').staleChanges(root, changes);
    if (stale.length) attention.push({ area: 'retrieve', file: null, text: `${stale.length} arquivo(s) alterado(s) sem retrieve antes: ${stale.slice(0, 5).map((f) => f.split('/').pop()).join(', ')}${stale.length > 5 ? '…' : ''}`, fix: 'Compare com a org sem perder o seu: reldor retrieve --compare --files <arquivos>. Nos próximos, rode reldor retrieve --files antes de mexer.' });
  }
  // Nothing is left out silently: every capability another tool takes care of is listed with its owner.
  const REVIEW_PARTS = ['retrieve-first', 'security', 'quality', 'code-analyzer', 'queries', 'affected-tests', 'xml-duplicates', 'xml-order', 'org-files'];
  const others = REVIEW_PARTS.map((id) => tools.resolveTool(config, id)).filter((t) => t.mode !== 'run');
  const low = qualityFindings.filter((f) => f.severity === 'baixa').length;
  return {
    files: files.length,
    blocking,
    attention,
    low,
    tests,
    analyzer: { ran: q.analyzer.ran, note: tools.runs(config, 'code-analyzer') ? q.analyzer.note : null, skipped: !tools.runs(config, 'code-analyzer') },
    tools: others,
    reused: [...new Set(reused)],
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
  if (!r.blocking.length && !r.attention.length) out.push('', '✅ Nada para corrigir no que esta revisão cobre.');
  if (r.low) out.push(`ℹ️  ${r.low} sugestão(ões) de qualidade de baixa prioridade (veja com --json).`);
  const high = r.tests.filter((t) => t.priority === 'alta');
  if (r.tests.length) {
    out.push('', `🧪 Testes que a mudança pode quebrar (${r.tests.length}): ${r.tests.slice(0, 6).map((t) => t.name).join(', ')}${r.tests.length > 6 ? '…' : ''}`);
    out.push(`   ➜ Para rodar na sandbox, sem salvar nada: reldor test-radar --run --org <alias>${high.length ? ` (${high.length} de prioridade alta)` : ''}`);
  }
  if (!r.analyzer.skipped) out.push('', r.analyzer.ran ? '✅ Regras do Salesforce Code Analyzer (PMD, CPD e segurança) incluídas.' : `ℹ️  ${r.analyzer.note || 'Code Analyzer não executado (--no-analyzer).'}`);
  const verified = r.tools.filter((t) => t.mode === 'verify');
  const skipped = r.tools.filter((t) => t.mode === 'skip');
  if (verified.length) out.push('', `🔎 Feito por outra ferramenta, o Reldor só conferiu: ${verified.map((t) => `${t.id}${t.owner ? ` (${t.owner})` : ''}`).join(', ')}`);
  if (skipped.length) out.push(`➖ Fora desta revisão, cuidado por outra ferramenta: ${skipped.map((t) => `${t.id}${t.owner ? ` (${t.owner})` : ''}`).join(', ')}`);
  if (r.reused.length) out.push(`♻️  Reaproveitado de uma execução anterior com o mesmo conteúdo (nada rodou duas vezes): ${r.reused.join(', ')}`);
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
