'use strict';

const { loadConfig } = require('../config');
const { logAction } = require('../log');
const { print, printJson } = require('../report');
const { buildIndex } = require('../../modules/sf/indexer');
const { explainObject, renderExplain, EVENTS } = require('../../modules/sf/explain');
const { findUsages, renderUsages } = require('../../modules/sf/checks/usages');
const { checkQueries } = require('../../modules/sf/checks/queries');
const { buildRadar } = require('../../modules/sf/test-radar');
const { refineBrief, renderBrief } = require('../../modules/sf/refine');
const { changedFiles } = require('../../modules/sf/test-radar/changes');
const { runTests } = require('../../modules/sf/org/sf');
const { resolveOrg } = require('../../modules/sf/org/guard');
const path = require('node:path');
const fs = require('node:fs');
const readline = require('node:readline/promises');

function requireSfProject(root) {
  const { readProject } = require('../../modules/sf');
  if (!readProject(root)) {
    process.stderr.write('⚠️ sfdx-project.json não encontrado: rode o comando dentro de um projeto Salesforce.\n');
    return false;
  }
  return true;
}

/** Index is rebuilt incrementally every time: only changed files are read again. */
function freshModel(root, flags) {
  return buildIndex(root, { full: Boolean(flags.full) });
}

function indexCommand(root, flags) {
  if (!requireSfProject(root)) return 1;
  const { stats, model } = freshModel(root, flags);
  logAction(root, 'index', { summary: `${stats.files} arquivos (${stats.parsed} lidos, ${stats.reused} reaproveitados)` });
  if (flags.json) {
    printJson(stats);
    return 0;
  }
  const out = [
    '\n🛡️  Índice atualizado',
    '',
    `• ${stats.objects} objetos, ${stats.classes} classes Apex, ${stats.triggers} triggers, ${stats.flows} flows, ${stats.lwc} LWCs`,
    `• ${stats.parsed} arquivo(s) lido(s), ${stats.reused} reaproveitado(s), ${stats.removed} removido(s) · ${stats.ms} ms`,
  ];
  if (stats.errors) out.push(`⚠️ ${stats.errors} arquivo(s) não puderam ser lidos: ${model.errors.slice(0, 5).join('; ')}`);
  out.push('', '➡️  Experimente: reldor explain Account   ou   reldor usages Account.Name');
  print(out);
  return 0;
}

function explainCommand(root, flags, args) {
  if (!requireSfProject(root)) return 1;
  const object = args[0];
  if (!object) {
    process.stderr.write('⚠️ Informe o objeto. Ex.: reldor explain Opportunity --event update\n');
    return 1;
  }
  const event = flags.event || 'update';
  if (!EVENTS.includes(event)) {
    process.stderr.write(`⚠️ Evento inválido: ${event}. Use: ${EVENTS.join(', ')}.\n`);
    return 1;
  }
  const { model } = freshModel(root, flags);
  const name = Object.keys(model.objects).find((o) => o.toLowerCase() === object.toLowerCase());
  if (!name) {
    process.stderr.write(`⚠️ Não encontrei o objeto ${object} no projeto.\n`);
    return 1;
  }
  const result = explainObject(model, name, event);
  logAction(root, 'explain', { summary: `${name} (${event})` });
  if (flags.json) printJson(result);
  else print(renderExplain(result));
  return 0;
}

function usagesCommand(root, flags, args) {
  if (!requireSfProject(root)) return 1;
  const query = args[0];
  if (!query) {
    process.stderr.write('⚠️ Informe o item. Ex.: reldor usages Account.CPF__c   ou   reldor usages AccountService.calcularScore\n');
    return 1;
  }
  const { model } = freshModel(root, flags);
  const hits = findUsages(model, query);
  logAction(root, 'usages', { summary: `${query}: ${hits.length} uso(s)` });
  if (flags.json) printJson({ query, hits });
  else print(renderUsages(query, hits));
  return 0;
}

function renderQueryIssues(issues) {
  if (!issues.length) return [];
  return [
    '',
    `⚠️ Possível campo fora da query (${issues.length}):`,
    ...issues.map((i) => `   • ${i.class}: ${i.object}.${i.field} é lido, mas não está na SOQL/Selector (${i.certainty})`),
    '   Em produção isso gera: "SObject row was retrieved via SOQL without querying the requested field".',
  ];
}

/** Paths to send in a check-only deploy: changed files inside the package directories (LWC as its folder). */
function sourcePathsFor(root, changes) {
  const { readProject } = require('../../modules/sf');
  const dirs = (readProject(root)?.packageDirectories || ['force-app']).map((d) => d.replace(/\\/g, '/').replace(/\/$/, ''));
  const out = new Set();
  for (const c of changes) {
    if (c.status === 'deleted') continue;
    if (!dirs.some((d) => c.file === d || c.file.startsWith(`${d}/`))) continue;
    if (!fs.existsSync(path.join(root, c.file))) continue;
    const type = c.meta ? c.meta.type : c.type;
    out.add(type === 'lwcJs' || type === 'lwcHtml' ? path.posix.dirname(c.file) : c.file);
  }
  return [...out];
}

async function confirm(question) {
  if (!process.stdin.isTTY) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^s/i.test((await rl.question(`${question} (s/n): `)).trim());
  } finally {
    rl.close();
  }
}

function renderRun(result, target, coverageTarget, changedClasses) {
  const out = [''];
  if (!result.ok) return [...out, `❌ Não consegui rodar os testes: ${result.error}`];
  out.push(result.mode === 'validate' ? `🧪 Validação sem salvar em ${target} (suas mudanças locais + testes):` : `🧪 Testes em ${target} (código que já está na org):`);
  if (result.componentErrors.length) {
    out.push(`❌ ${result.componentErrors.length} erro(s) de deploy:`);
    for (const e of result.componentErrors.slice(0, 10)) out.push(`   • ${e.type || ''} ${e.name}: ${e.problem}`);
  }
  out.push(`${result.failed.length ? '❌' : '✅'} ${result.passed.length} passaram, ${result.failed.length} falharam`);
  for (const f of result.failed.slice(0, 15)) out.push(`   • ${f.test}: ${f.message}`);
  const low = result.coverage.filter((c) => changedClasses.includes(c.name) && c.percent < coverageTarget);
  for (const c of result.coverage.filter((x) => changedClasses.includes(x.name))) out.push(`${c.percent < coverageTarget ? '⚠️' : '✅'} Cobertura de ${c.name}: ${c.percent}% (meta ${coverageTarget}%)`);
  if (low.length) out.push(`⚠️ ${low.length} classe(s) alterada(s) abaixo da meta de cobertura.`);
  return out;
}

async function testRadarCommand(root, flags) {
  if (!requireSfProject(root)) return 1;
  const { config } = loadConfig(root);
  const { model } = freshModel(root, flags);
  const changes = changedFiles(root, config, { base: flags.base, files: flags.files });
  const radar = buildRadar(model, changes);
  const issues = radar.classes.length ? checkQueries(model, radar.classes) : [];
  const result = { ...radar, queryIssues: issues };

  const out = ['\n🛡️  Radar de testes', ''];
  if (!changes.length) out.push('Nenhuma mudança de metadado encontrada (compare com --base <branch> ou informe --files).');
  else {
    out.push(`• ${changes.length} arquivo(s) alterado(s)${radar.objects.length ? ` · objetos: ${radar.objects.join(', ')}` : ''}${radar.classes.length ? ` · classes: ${radar.classes.join(', ')}` : ''}`);
    out.push('');
    if (!radar.tests.length) out.push('Nenhuma classe de teste afetada foi encontrada.');
    else {
      out.push(`Testes afetados (${radar.tests.length}):`);
      for (const t of radar.tests) out.push(`${t.priority === 'alta' ? '🔴' : '🟡'} ${t.name} — ${t.reasons.join('; ')}`);
    }
  }
  out.push(...renderQueryIssues(issues));
  for (const n of radar.notes) out.push(`ℹ️  ${n}`);

  if (!flags.run) {
    if (radar.tests.length) out.push('', '➡️  Para rodar estes testes na sandbox, sem salvar nada: reldor test-radar --run --org <alias>');
    logAction(root, 'test-radar', { summary: `${changes.length} mudança(s), ${radar.tests.length} teste(s)` });
    if (flags.json) printJson(result);
    else print(out);
    return 0;
  }

  if (!radar.tests.length) {
    if (flags.json) printJson(result);
    else print([...out, '', 'Nada para rodar.']);
    return 0;
  }
  const { readProject } = require('../../modules/sf');
  const sfModule = require('../../modules/sf');
  const target = resolveOrg(config, flags, flags.org || config.reference_org ? null : sfModule.detect(root).defaultOrg);
  if (target.error) {
    process.stderr.write(`⚠️ ${target.error}\n`);
    return 1;
  }
  if (target.production && !flags['allow-production']) {
    process.stderr.write(`🛡️ ${target.org} é produção. O radar não roda lá por padrão.\n`);
    return 1;
  }
  if (!flags.json) print(out);
  const ok = flags.yes || (await confirm(`\n🛡️ Rodar ${radar.tests.length} teste(s) na org ${target.org}${target.environment ? ` (${target.environment})` : ''}?`));
  if (!ok) {
    print('Cancelado. Nada foi executado.');
    return 0;
  }
  const sourcePaths = flags['org-code'] ? [] : sourcePathsFor(root, changes);
  const run = runTests(root, { org: target.org, tests: radar.tests.map((t) => t.name), sourcePaths, wait: Number(flags.wait) || 60 });
  const coverageTarget = Number(config.test_radar?.coverage_target) || 75;
  logAction(root, 'test-radar-run', { summary: `${target.org}: ${run.ok ? `${run.passed.length} ok, ${run.failed.length} falha(s)` : 'erro'}` });
  if (flags.json) printJson({ ...result, org: target.org, run });
  else print(renderRun(run, target.org, coverageTarget, radar.classes));
  return run.ok && run.success ? 0 : 2;
}

function refineCommand(root, flags, args) {
  if (!requireSfProject(root)) return 1;
  const text = args.join(' ');
  const list = (v) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
  if (!text && !flags.objects && !flags.fields) {
    process.stderr.write('⚠️ Descreva a ideia da task. Ex.: reldor refine "bloquear o fechamento da oportunidade sem proposta aprovada"\n');
    return 1;
  }
  const { model } = freshModel(root, flags);
  const brief = refineBrief(model, { text, objects: list(flags.objects), fields: list(flags.fields) });
  logAction(root, 'refine', { summary: `${brief.objects.map((o) => o.name).join(', ') || 'nenhum objeto'} · ${brief.signal.size}` });
  if (flags.json) printJson(brief);
  else print(renderBrief(brief));
  return 0;
}

function checkCommand(root, flags, args) {
  if (!requireSfProject(root)) return 1;
  const { model } = freshModel(root, flags);
  const issues = checkQueries(model, args);
  logAction(root, 'check', { summary: `${issues.length} possível(is) campo(s) fora da query` });
  if (flags.json) printJson({ queryIssues: issues });
  else print(['\n🛡️  Checagem de queries', '', issues.length ? '' : '✅ Nenhum campo lido fora da query encontrado.', ...renderQueryIssues(issues).slice(1)].filter((l, i) => i !== 2 || l));
  return 0;
}

module.exports = { indexCommand, explainCommand, usagesCommand, testRadarCommand, checkCommand, refineCommand, loadConfig };
