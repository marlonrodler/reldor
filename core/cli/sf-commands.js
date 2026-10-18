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
const xmlOrganizer = require('../../modules/sf/xml');
const security = require('../../modules/sf/security');
const quality = require('../../modules/sf/quality');
const { organizeXml } = require('../../modules/sf/xml/organize');
const snapshotApi = require('../git/snapshot');
const gitApi = require('../git');
const { runSf } = require('../../modules/sf/org/sf');
const { changedFiles, defaultBase } = require('../../modules/sf/test-radar/changes');
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
  const elsewhere = findUsagesElsewhere(hits);
  if (flags.json) printJson({ query, hits, elsewhere });
  else print([...renderUsages(query, hits), ...renderElsewhere(query, elsewhere)]);
  return 0;
}

/** References to a field with the same name on other objects: left out, but said, so nothing is silent. */
function findUsagesElsewhere(hits) {
  return hits.elsewhere || [];
}

function renderElsewhere(query, elsewhere) {
  if (!elsewhere.length) return [];
  const byObject = {};
  for (const e of elsewhere) (byObject[e.object] = byObject[e.object] || new Set()).add(e.name);
  const parts = Object.entries(byObject).map(([o, names]) => `${o} (${[...names].slice(0, 4).join(', ')}${names.size > 4 ? `, +${names.size - 4}` : ''})`);
  return ['', `ℹ️  Fora da lista: campos com o mesmo nome em outros objetos — ${parts.join('; ')}.`];
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

function renderXml(results, check) {
  const out = ['\n🛡️  Organizador de XML', ''];
  if (!results.length) return [...out, 'Nenhum XML organizável entre os arquivos escolhidos.'];
  const touched = results.filter((r) => r.changed);
  for (const r of results) {
    if (r.error) out.push(`❌ ${r.file}: ${r.error}`);
    else if (r.changed) out.push(`${check ? '⚠️' : '✅'} ${r.file}: ${[r.duplicates && `${r.duplicates} duplicado(s) ${check ? 'a remover' : 'removido(s)'}`, r.sorted && (check ? 'fora de ordem' : 'ordenado')].filter(Boolean).join(', ')}`);
    for (const c of r.conflicts) out.push(`   ⚠️ conflito em ${c.section} "${c.key}": duas entradas com valores diferentes. Decida qual fica.`);
  }
  if (!touched.length && !results.some((r) => r.conflicts.length)) out.push(`✅ ${results.length} arquivo(s) já estão organizados.`);
  if (check && touched.length) out.push('', '➡️  Para organizar: reldor xml');
  return out;
}

function xmlCommand(root, flags, args) {
  if (!requireSfProject(root)) return 1;
  const { config } = loadConfig(root);
  const { readProject } = require('../../modules/sf');
  let files = args;
  if (flags.all) files = xmlOrganizer.allOrganizable(root, readProject(root).packageDirectories);
  else if (!files.length) files = changedFiles(root, config, { base: flags.base }).filter((c) => c.status !== 'deleted').map((c) => c.file).filter((f) => xmlOrganizer.isOrganizable(f));
  const results = xmlOrganizer.organizeFiles(root, files, { check: Boolean(flags.check) });
  const changed = results.filter((r) => r.changed).length;
  const conflicts = results.reduce((n, r) => n + r.conflicts.length, 0);
  if (!flags.check) logAction(root, 'xml', { summary: `${changed} arquivo(s) organizado(s), ${conflicts} conflito(s)` });
  if (flags.json) printJson({ results });
  else print(renderXml(results, Boolean(flags.check)));
  return flags.check && (changed || conflicts) ? 1 : 0;
}

/** Pre-commit guard: blocks unorganized XML and files that only came from the org. */
function precommitCommand(root) {
  const git = (args) => gitApi.git(root, args);
  const staged = (git(['diff', '--cached', '--name-only', '--diff-filter=ACM']).stdout || '').split('\n').filter(Boolean);
  const problems = [];
  for (const file of staged.filter((f) => xmlOrganizer.isOrganizable(f))) {
    const content = gitApi.git(root, ['show', `:${file}`]);
    if (!content.ok) continue;
    try {
      const r = organizeXml(content.stdout + '\n');
      if (r.report.duplicates) problems.push(`${file}: ${r.report.duplicates} entrada(s) duplicada(s). Rode "reldor xml ${file}" e "git add ${file}".`);
      for (const c of r.report.conflicts) problems.push(`${file}: duas entradas diferentes para ${c.section} "${c.key}". Decida qual fica.`);
    } catch {
      /* not our business if the XML is unusual */
    }
  }
  const snapshot = process.env.RELDOR_CLEAN_COMMIT ? null : snapshotApi.loadSnapshot(root);
  if (snapshot) {
    const head = git(['rev-parse', '--verify', '--quiet', 'HEAD']).stdout;
    const fromOrg = new Set(head ? (git(['diff', '--name-only', '--no-renames', head, snapshot.tree]).stdout || '').split('\n').filter(Boolean) : []);
    for (const file of staged.filter((f) => fromOrg.has(f))) {
      const mine = git(['rev-parse', `:${file}`]).stdout;
      const org = git(['rev-parse', `${snapshot.tree}:${file}`]).stdout;
      if (mine && mine === org) problems.push(`${file}: veio da org no último retrieve e você não mudou nada nele.`);
    }
  }
  if (!problems.length) return 0;
  process.stderr.write([
    '',
    '🛡️  Reldor barrou o commit:',
    ...problems.map((p) => `   • ${p}`),
    '',
    'Para commitar só o que é seu: reldor commit -m "mensagem"',
    'Se for intencional: git commit --no-verify',
    '',
  ].join('\n'));
  return 1;
}

async function retrieveCommand(root, flags) {
  if (!requireSfProject(root)) return 1;
  const { config } = loadConfig(root);
  const sfModule = require('../../modules/sf');
  const target = resolveOrg(config, flags, flags.org || config.reference_org ? null : sfModule.detect(root).defaultOrg);
  if (target.error) {
    process.stderr.write(`⚠️ ${target.error}\n`);
    return 1;
  }
  const pending = gitApi.pendingChanges(root);
  const pendingCount = Object.values(pending).reduce((n, l) => n + l.length, 0);
  const specific = Boolean(flags.metadata);
  const out = [
    '\n🛡️  Retrieve',
    '',
    `• Org: ${target.org}${target.environment ? ` (${target.environment})` : ''}${target.production ? ' · PRODUÇÃO (só leitura)' : ''}`,
    `• O quê: ${flags.metadata || flags.manifest || flags['source-dir'] || 'o projeto inteiro (pastas do sfdx-project.json)'}`,
    specific ? '• Retrieve específico: o que vier conta como SEU no commit.' : '• Depois do retrieve, o Reldor tira uma foto: o que vier da org fica fora do seu commit.',
  ];
  if (pendingCount) out.push('', `⚠️ Você tem ${pendingCount} arquivo(s) não commitado(s). O retrieve pode sobrescrever essas mudanças.`);
  print(out);
  const rl = flags.yes || !process.stdin.isTTY ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (rl && !/^s/i.test((await rl.question(`\n🛡️ Fazer o retrieve da org ${target.org}? (s/n): `)).trim())) {
      print('Cancelado. Nada foi alterado.');
      return 0;
    }
  } finally {
    if (rl) rl.close();
  }
  const args = ['project', 'retrieve', 'start', '--json', '--target-org', target.org];
  const many = (flag, name) => (typeof flags[flag] === 'string' ? flags[flag].split(',').map((x) => x.trim()).filter(Boolean).flatMap((v) => [name, v]) : []);
  args.push(...many('metadata', '--metadata'), ...many('source-dir', '--source-dir'));
  if (typeof flags.manifest === 'string') args.push('--manifest', flags.manifest);
  const res = runSf(args, { cwd: root, timeout: 30 * 60000 });
  const { parseJson } = require('../../modules/sf/org/sf');
  const json = parseJson(res.stdout);
  if (!json || json.status !== 0) {
    print(`❌ O retrieve falhou: ${(json && json.message) || res.stderr || 'sem resposta do sf CLI'}`);
    return 1;
  }
  const files = (json.result && json.result.files) || [];
  let snap = null;
  if (!specific || flags['as-org']) snap = snapshotApi.takeSnapshot(root, `retrieve ${target.org}`);
  logAction(root, 'retrieve', { summary: `${target.org}: ${files.length} arquivo(s)${snap ? ', foto tirada' : ''}` });
  print([
    '',
    `✅ Retrieve concluído: ${files.length} arquivo(s).`,
    snap ? '📸 Foto tirada. Quando for commitar: reldor commit -m "mensagem"' : 'ℹ️  Sem foto: o que veio conta como seu.',
  ]);
  return 0;
}

const SEV_ICON = { alta: '🔴', 'média': '🟡', baixa: '⚪' };

function renderSecurity(r) {
  const out = ['\n🛡️  Revisão de segurança', '', `• ${r.files} arquivo(s) analisado(s) · 🔴 ${r.counts.alta} alta · 🟡 ${r.counts['média']} média · ⚪ ${r.counts.baixa} baixa`];
  if (!r.findings.length) out.push('', '✅ Nenhum problema de segurança encontrado nesses arquivos.');
  for (const sev of ['alta', 'média', 'baixa']) {
    const list = r.findings.filter((f) => f.severity === sev);
    if (!list.length) continue;
    out.push('', `${SEV_ICON[sev]} Prioridade ${sev}:`);
    for (const f of list) {
      out.push(`   • ${f.file || ''}${f.line ? `:${f.line}` : ''} — ${f.message}${f.source === 'code-analyzer' ? ` [${f.rule}]` : ''}`);
      if (f.path) out.push(`     caminho: ${f.path.join(' → ')}`);
      if (f.fix) out.push(`     ➜ ${f.fix}`);
    }
  }
  out.push('', r.analyzer.ran ? '✅ Regras oficiais do Salesforce Code Analyzer incluídas.' : `ℹ️  ${r.analyzer.note || 'Code Analyzer não executado (--no-analyzer).'}`);
  out.push('ℹ️  Esta revisão não substitui pentest nem a análise da equipe de segurança.');
  return out;
}

function securityCommand(root, flags, args) {
  if (!requireSfProject(root)) return 1;
  const { config } = loadConfig(root);
  const { readProject } = require('../../modules/sf');
  let files = args;
  if (flags.all) files = security.allScannable(root, readProject(root).packageDirectories);
  else if (!files.length) files = changedFiles(root, config, { base: flags.base }).filter((c) => c.status !== 'deleted').map((c) => c.file).filter((f) => security.isScannable(f));
  const { model } = freshModel(root, flags);
  const result = security.securityReview(root, files, {
    model,
    sensitiveTerms: config.security?.sensitive_terms,
    strictSharing: Boolean(config.security?.strict_sharing),
    analyzer: !flags['no-analyzer'],
  });
  logAction(root, 'security', { summary: `${files.length} arquivo(s): ${result.counts.alta} alta, ${result.counts['média']} média` });
  if (flags.json) printJson(result);
  else print(renderSecurity(result));
  const failOn = flags['fail-on'];
  if (failOn === 'alta' && result.counts.alta) return 1;
  if (failOn === 'média' && (result.counts.alta || result.counts['média'])) return 1;
  return 0;
}

const KIND_LABEL = {
  'bloco-copiado': 'Bloco copiado',
  'soql-repetida': 'Query repetida',
  'soql-fora-do-selector': 'Query fora do Selector',
  'metodo-ja-existe': 'Método que já existe',
  'metodo-parecido': 'Método parecido',
  'texto-repetido': 'Texto repetido',
  'code-analyzer': 'Code Analyzer',
};

function renderQuality(r) {
  const out = ['\n🛡️  Revisão de qualidade', '', `• ${r.files} classe(s) analisada(s) · 🔴 ${r.counts.alta} alta · 🟡 ${r.counts['média']} média · ⚪ ${r.counts.baixa} baixa`];
  if (!r.findings.length) out.push('', '✅ Nenhuma repetição nova nem problema de qualidade nesses arquivos.');
  for (const sev of ['alta', 'média', 'baixa']) {
    const list = r.findings.filter((f) => f.severity === sev);
    if (!list.length) continue;
    out.push('', `${SEV_ICON[sev]} Prioridade ${sev}:`);
    for (const f of list) {
      const label = f.kind === 'code-analyzer' ? `[${f.rule}]` : `${KIND_LABEL[f.kind] || f.kind}:`;
      out.push(`   • ${f.file || ''}${f.line ? `:${f.line}` : ''} — ${label} ${f.message}`);
      if (f.fix) out.push(`     ➜ ${f.fix}`);
    }
  }
  out.push('', r.analyzer.ran ? '✅ Regras Recommended do PMD e o CPD (Code Analyzer) incluídos.' : `ℹ️  ${r.analyzer.note || 'Code Analyzer não executado (--no-analyzer).'}`);
  return out;
}

function qualityCommand(root, flags, args) {
  if (!requireSfProject(root)) return 1;
  const { config } = loadConfig(root);
  const { readProject } = require('../../modules/sf');
  const packageDirectories = readProject(root).packageDirectories;
  let files = args.map((f) => f.split(path.sep).join('/'));
  if (!flags.all && !files.length) files = changedFiles(root, config, { base: flags.base }).filter((c) => c.status !== 'deleted').map((c) => c.file);
  const { model } = freshModel(root, flags);
  const result = quality.qualityReview(root, files, {
    model,
    packageDirectories,
    base: flags.base || defaultBase(root, config),
    all: Boolean(flags.all),
    analyzer: !flags['no-analyzer'],
    options: config.quality || {},
  });
  logAction(root, 'quality', { summary: `${result.files} classe(s): ${result.findings.length} apontamento(s)` });
  if (flags.json) printJson(result);
  else print(renderQuality(result));
  const failOn = flags['fail-on'];
  if (failOn === 'alta' && result.counts.alta) return 1;
  if (failOn === 'média' && (result.counts.alta || result.counts['média'])) return 1;
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

module.exports = { indexCommand, explainCommand, usagesCommand, testRadarCommand, checkCommand, refineCommand, xmlCommand, precommitCommand, retrieveCommand, securityCommand, qualityCommand, loadConfig };
