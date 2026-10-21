'use strict';

const { loadConfig } = require('../config');
const { logAction } = require('../log');
const { print, printJson } = require('../report');
const { buildIndex } = require('../../modules/sf/indexer');
const { explainObject, renderExplain, EVENTS } = require('../../modules/sf/explain');
const { findUsages, renderUsages } = require('../../modules/sf/checks/usages');
const { checkQueries } = require('../../modules/sf/checks/queries');
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

/** Lines that say which of these capabilities another tool of the team takes care of (tools: in the config). */
function toolNotes(config, ids) {
  const tools = require('../tools');
  return ids.map((id) => tools.ownerNote(config, id)).filter(Boolean).map((n) => `🔎 ${n}`);
}

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
  // Fields: the developer's second look at what code reaches only by name (stores of field names, texts in code).
  let dynamic = null;
  const [qLeft, qRight] = query.includes('.') ? query.split('.', 2) : [null, query];
  if (/__c$/i.test(qRight) && !model.classes[qLeft || '']) {
    const { analyzeDynamicField } = require('../../modules/sf/checks/dynamicfields');
    dynamic = analyzeDynamicField(model, qLeft, qRight, hits.filter((h) => h.certainty !== 'certo'));
  }
  if (flags.json) printJson({ query, hits, elsewhere, dynamic });
  else {
    const { renderDynamicField } = require('../../modules/sf/checks/dynamicfields');
    print([...renderUsages(query, hits), ...renderElsewhere(query, elsewhere), ...(dynamic ? renderDynamicField(qLeft, qRight, dynamic) : [])]);
  }
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

const { confirm } = require('./confirm');

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
  const shared = require('./checks');
  const tools = require('../tools');
  const radar = shared.radarRun(root, changes, model).result;
  const issues = radar.classes.length && tools.checks(config, 'queries') ? shared.queriesRun(root, radar.classes, model).result : [];
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
  out.push(...toolNotes(config, ['affected-tests', 'run-tests']));

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
  // Running tests in the org is an action: when another tool owns it (the pipeline), only --force runs it.
  if (!tools.runs(config, 'run-tests') && !flags.force) {
    const note = tools.ownerNote(config, 'run-tests');
    if (flags.json) printJson({ ...result, run: null, skipped: note });
    else print([...out, '', `➖ ${note}`, '   Não rodei nada. Para rodar mesmo assim: reldor test-radar --run --force']);
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
  // Execution off (the default): the tests run in the org, so the person runs the command.
  if (!require('../config').executeOn(config)) {
    const { handover, cmdLine } = require('../report');
    const { testArgs } = require('../../modules/sf/org/sf');
    const sourcePaths = flags['org-code'] ? [] : sourcePathsFor(root, changes);
    const cmd = cmdLine(['sf', ...testArgs({ org: target.org, tests: radar.tests.map((t) => t.name), sourcePaths, wait: Number(flags.wait) || 60, json: false })]);
    const why = sourcePaths.length ? 'validação: sobe os seus arquivos sem salvar e roda só esses testes' : 'roda os testes contra o que já está na org';
    if (flags.json) printJson({ ...result, org: target.org, commands: [cmd] });
    else print([...out, ...handover([{ cmd, why }]), '   Depois, cole o resultado aqui (ou para a IA) para ver falhas e cobertura.']);
    return 0;
  }
  if (!flags.json) print(out);
  const ok = await confirm(`\n🛡️ Rodar ${radar.tests.length} teste(s) na org ${target.org}${target.environment ? ` (${target.environment})` : ''}?`, flags);
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
  if (check && touched.length) out.push('', '➡️  Para organizar: reldor xml (ou a ferramenta do time que cuida disso)');
  return out;
}

async function xmlCommand(root, flags, args) {
  if (!requireSfProject(root)) return 1;
  const tools = require('../tools');
  const { config } = loadConfig(root);
  const { readProject } = require('../../modules/sf');
  let files = args;
  if (flags.all) files = xmlOrganizer.allOrganizable(root, readProject(root).packageDirectories);
  else if (!files.length) files = changedFiles(root, config, { base: flags.base }).filter((c) => c.status !== 'deleted').map((c) => c.file).filter((f) => xmlOrganizer.isOrganizable(f));
  // Organizing changes files: only when the Reldor owns both sorting and duplicates here (or --force).
  // When another tool owns them, the Reldor only checks, so the two tools never rewrite the same file.
  const owned = tools.runs(config, 'xml-duplicates') && tools.runs(config, 'xml-order');
  const check = Boolean(flags.check) || (!owned && !flags.force);
  const notes = ['xml-duplicates', 'xml-order'].map((id) => tools.ownerNote(config, id)).filter(Boolean);
  // Organizing changes files in the folder: show what would change and ask first.
  if (!check) {
    const preview = xmlOrganizer.organizeFiles(root, files, { check: true });
    const touched = preview.filter((r) => r.changed);
    if (touched.length) {
      if (!flags.json) print([...renderXml(preview, true).slice(0, -2), '']);
      if (!(await confirm(`🛡️ Organizar ${touched.length} arquivo(s) (ordenar e tirar duplicados idênticos)?`, flags))) {
        print('Cancelado. Nada foi alterado.');
        return 0;
      }
    }
  }
  let results = xmlOrganizer.organizeFiles(root, files, { check });
  // A part another tool owns and the Reldor does not even check (skip) does not count.
  if (check) {
    const dup = tools.checks(config, 'xml-duplicates');
    const order = tools.checks(config, 'xml-order');
    results = results.map((r) => ({ ...r, duplicates: dup ? r.duplicates : 0, sorted: order ? r.sorted : 0, conflicts: dup ? r.conflicts : [] })).map((r) => ({ ...r, changed: Boolean(r.duplicates || r.sorted) }));
  }
  const changed = results.filter((r) => r.changed).length;
  const conflicts = results.reduce((n, r) => n + r.conflicts.length, 0);
  if (!check) logAction(root, 'xml', { summary: `${changed} arquivo(s) organizado(s), ${conflicts} conflito(s)` });
  if (flags.json) printJson({ results, checkOnly: check, tools: notes });
  else {
    const out = renderXml(results, check);
    if (notes.length) {
      out.push('', ...notes.map((n) => `🔎 ${n}`));
      if (!flags.check && !owned) out.push(changed ? '   Não mudei nada. Rode a ferramenta do time nesses arquivos (ou reldor xml --force para o Reldor organizar mesmo assim).' : '   Não mudei nada: só conferi.');
    }
    print(out);
  }
  return check && (changed || conflicts) ? 1 : 0;
}

/**
 * Pre-commit guard: blocks XML with duplicated entries (or two different values for one item) and files that only
 * came from the org. It follows tools: (a check another tool owns is verified, or left out) and the run ledger
 * (a file whose content the review already checked is not checked again).
 */
function precommitCommand(root) {
  const tools = require('../tools');
  const { config } = loadConfig(root);
  const git = (args) => gitApi.git(root, args);
  const staged = (git(['diff', '--cached', '--name-only', '--diff-filter=ACM']).stdout || '').split('\n').filter(Boolean);
  const problems = [];
  if (tools.checks(config, 'xml-duplicates')) {
    const how = (file) => tools.fixHint(config, 'xml-duplicates', `Rode "reldor xml ${file}" e "git add ${file}".`);
    for (const file of staged.filter((f) => xmlOrganizer.isOrganizable(f))) {
      const content = gitApi.git(root, ['show', `:${file}`], { raw: true });
      if (!content.ok) continue;
      try {
        const { result: r } = xmlOrganizer.checkXml(root, file, content.stdout);
        if (!r.supported) continue;
        if (r.duplicates) problems.push(`${file}: ${r.duplicates} entrada(s) duplicada(s). ${how(file)}`);
        for (const c of r.conflicts) problems.push(`${file}: duas entradas diferentes para ${c.section} "${c.key}". Decida qual fica.`);
      } catch {
        /* not our business if the XML is unusual */
      }
    }
  }
  const snapshot = process.env.RELDOR_CLEAN_COMMIT || !tools.checks(config, 'org-files') ? null : snapshotApi.loadSnapshot(root);
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
  const sfArgs = ['project', 'retrieve', 'start', '--target-org', target.org];
  const manyArgs = (flag, name) => (typeof flags[flag] === 'string' ? flags[flag].split(',').map((x) => x.trim()).filter(Boolean).flatMap((v) => [name, v]) : []);
  sfArgs.push(...manyArgs('metadata', '--metadata'), ...manyArgs('source-dir', '--source-dir'));
  if (typeof flags.manifest === 'string') sfArgs.push('--manifest', flags.manifest);
  // Execution off (the default): the retrieve changes the folder with what is in the org, so the person runs it.
  if (!require('../config').executeOn(config)) {
    const { handover, cmdLine } = require('../report');
    const steps = [{ cmd: cmdLine(['sf', ...sfArgs]), why: 'traz da org' }];
    if (!specific || flags['as-org']) steps.push({ cmd: 'reldor snapshot', why: 'logo depois: o que veio conta como da org, fora do seu commit' });
    if (flags.json) printJson({ org: target.org, production: target.production, commands: steps.map((s) => s.cmd) });
    else print([...out, ...handover(steps)]);
    return 0;
  }
  print(out);
  if (!(await confirm(`\n🛡️ Fazer o retrieve da org ${target.org}?`, flags))) {
    print('Cancelado. Nada foi alterado.');
    return 0;
  }
  const res = runSf([...sfArgs, '--json'], { cwd: root, timeout: 30 * 60000 });
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
  const tools = require('../tools');
  const shared = require('./checks');
  const { runAnalyzer } = require('../../modules/sf/security/analyzer');
  const { config } = loadConfig(root);
  const { readProject } = require('../../modules/sf');
  let files = args;
  if (flags.all) files = security.allScannable(root, readProject(root).packageDirectories);
  else if (!files.length) files = changedFiles(root, config, { base: flags.base }).filter((c) => c.status !== 'deleted').map((c) => c.file).filter((f) => security.isScannable(f));
  const { model } = freshModel(root, flags);
  // Asked by name, the Reldor rules always run (and are reused if the same content was already checked).
  const rules = shared.securityRules(root, files, model, config);
  const result = { ...rules.result, findings: [...rules.result.findings] };
  // The Code Analyzer runs unless another tool owns it here (then --analyzer forces it) or --no-analyzer.
  const useAnalyzer = !flags['no-analyzer'] && (tools.runs(config, 'code-analyzer') || flags.analyzer);
  const ca = useAnalyzer ? runAnalyzer(root, files.filter((f) => security.isScannable(f))) : { ran: false, findings: [], note: tools.runs(config, 'code-analyzer') ? null : 'O Code Analyzer fica com outra ferramenta do time aqui (para rodar mesmo assim: --analyzer).' };
  result.findings.push(...ca.findings);
  const order = { alta: 0, 'média': 1, baixa: 2 };
  result.findings.sort((a, b) => order[a.severity] - order[b.severity] || String(a.file).localeCompare(String(b.file)) || (a.line || 0) - (b.line || 0));
  result.counts = { alta: 0, 'média': 0, baixa: 0 };
  for (const f of result.findings) result.counts[f.severity] += 1;
  result.analyzer = { ran: ca.ran, note: ca.note || null, reused: Boolean(ca.reused) };
  result.reused = rules.reused;
  logAction(root, 'security', { summary: `${files.length} arquivo(s): ${result.counts.alta} alta, ${result.counts['média']} média` });
  if (flags.json) printJson(result);
  else print([...renderSecurity(result), ...toolNotes(config, ['security', 'code-analyzer']), ...(rules.reused ? ['♻️  Mesmo conteúdo já conferido antes: resultado reaproveitado (use --fresh para refazer).'] : [])]);
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
  const tools = require('../tools');
  const shared = require('./checks');
  const { config } = loadConfig(root);
  const { readProject } = require('../../modules/sf');
  const packageDirectories = readProject(root).packageDirectories;
  let files = args.map((f) => f.split(path.sep).join('/'));
  if (!flags.all && !files.length) files = changedFiles(root, config, { base: flags.base }).filter((c) => c.status !== 'deleted').map((c) => c.file);
  const { model } = freshModel(root, flags);
  const analyzer = !flags['no-analyzer'] && (tools.runs(config, 'code-analyzer') || Boolean(flags.analyzer));
  const run = shared.qualityRun(root, files, model, config, { packageDirectories, base: flags.base || defaultBase(root, config), all: Boolean(flags.all), analyzer });
  const result = run.result;
  if (!analyzer && !tools.runs(config, 'code-analyzer')) result.analyzer = { ran: false, note: 'O Code Analyzer fica com outra ferramenta do time aqui (para rodar mesmo assim: --analyzer).' };
  logAction(root, 'quality', { summary: `${result.files} classe(s): ${result.findings.length} apontamento(s)` });
  if (flags.json) printJson({ ...result, reused: run.reused });
  else print([...renderQuality(result), ...toolNotes(config, ['quality', 'code-analyzer']), ...(run.reused ? ['♻️  Mesmo conteúdo já conferido antes: resultado reaproveitado (use --fresh para refazer).'] : [])]);
  const failOn = flags['fail-on'];
  if (failOn === 'alta' && result.counts.alta) return 1;
  if (failOn === 'média' && (result.counts.alta || result.counts['média'])) return 1;
  return 0;
}

function checkCommand(root, flags, args) {
  if (!requireSfProject(root)) return 1;
  const shared = require('./checks');
  const { config } = loadConfig(root);
  const { model } = freshModel(root, flags);
  const issues = args.length ? shared.queriesRun(root, args, model).result : checkQueries(model, args);
  logAction(root, 'check', { summary: `${issues.length} possível(is) campo(s) fora da query` });
  if (flags.json) printJson({ queryIssues: issues });
  else print([...['\n🛡️  Checagem de queries', '', issues.length ? '' : '✅ Nenhum campo lido fora da query encontrado.', ...renderQueryIssues(issues).slice(1)].filter((l, i) => i !== 2 || l), ...toolNotes(config, ['queries'])]);
  return 0;
}

module.exports = { indexCommand, explainCommand, usagesCommand, testRadarCommand, checkCommand, refineCommand, xmlCommand, precommitCommand, retrieveCommand, securityCommand, qualityCommand, loadConfig };
