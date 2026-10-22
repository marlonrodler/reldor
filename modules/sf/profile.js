'use strict';

/**
 * The automatic part of profile.md for a Salesforce project, read from the project index (every file, no walk limit):
 * size, Apex structure (fflib, trigger handlers), naming habits and API version. Facts only: what the team decided is
 * written by the team, in its own section.
 */

/** Most common values of a list, as [value, count], biggest first. */
function top(values, min = 1, limit = 5) {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit);
}

/** Facts about the project, computed from the index model and sfdx-project.json. */
function profileFacts(model, project, teamsConfig = []) {
  const classes = Object.values(model.classes || {});
  const tests = classes.filter((c) => c.isTest && !/^fflib_/i.test(c.name));
  const code = classes.filter((c) => !c.isTest && !/^fflib_/i.test(c.name));
  const kind = (k) => code.filter((c) => (c.kinds || []).includes(k));
  const fflib = classes.some((c) => /^fflib_/i.test(c.name) || /^fflib_/i.test(c.extendsName || '')) || kind('application').length > 0;
  const handlers = kind('trigger-handler');
  const objects = Object.values(model.objects || {});
  const suffix = (name) => (name.match(/(_?Tests?|_TEST)$/i) || [null])[0];
  const prefixes = top(code.map((c) => (c.name.match(/^([A-Za-z0-9]{2,8})_/) || [])[1]), 3);
  return {
    packageDirectories: project?.packageDirectories || [],
    apiVersion: project?.apiVersion || null,
    counts: {
      classes: code.length,
      tests: tests.length,
      triggers: Object.keys(model.triggers || {}).length,
      flows: Object.keys(model.flows || {}).length,
      lwc: Object.keys(model.lwc || {}).length,
      screens: Object.keys(model.screens || {}).length,
      objects: objects.length,
      customObjects: objects.filter((o) => /__(c|mdt|e)$/i.test(o.name)).length,
    },
    fflib,
    layers: { services: kind('service').length, selectors: kind('selector').length, domains: kind('domain').length, controllers: kind('controller').length, batches: kind('batch').length, queueables: kind('queueable').length },
    handlers: { count: handlers.length, bases: top(handlers.map((c) => c.extendsName), 1, 3).map(([v, n]) => `${v} (${n})`) },
    testSuffix: top(tests.map((c) => suffix(c.name)), 1, 2).map(([v, n]) => `${v} (${n})`),
    prefixes: prefixes.map(([v, n]) => `${v}_ (${n})`),
    sharing: { declared: code.filter((c) => c.sharing && c.sharing !== 'none').length, total: code.length },
    parseErrors: (model.errors || []).length,
    patterns: patternSummary(model, code, tests),
    teams: teamSummary(model, teamsConfig),
  };
}

/** Up to two example names. */
const ex = (list) => (list.length ? ` (ex.: ${list.slice(0, 2).join(', ')})` : '');

/** How the code is built: triggers, async, tests, classic patterns, config and integration. Counts plus examples. */
function patternSummary(model, code, tests) {
  const withFlag = (flag, list = code) => list.filter((c) => (c.patterns || []).includes(flag)).map((c) => c.name);
  const triggers = Object.values(model.triggers || {});
  const perObject = new Map();
  for (const t of triggers) perObject.set(t.object, (perObject.get(t.object) || 0) + 1);
  const projectInterfaces = new Set(code.filter((c) => (c.kinds || []).includes('interface')).map((c) => c.name));
  const impls = new Map();
  for (const c of code) for (const i of c.implementsNames || []) if (projectInterfaces.has(i)) (impls.get(i) || impls.set(i, []).get(i)).push(c.name);
  const kind = (k) => code.filter((c) => (c.kinds || []).includes(k)).map((c) => c.name);
  const objects = Object.values(model.objects || {});
  return {
    triggers: { total: triggers.length, objectsWithMany: [...perObject].filter(([, n]) => n > 1).map(([o]) => o), withLogic: triggers.filter((t) => t.hasLogic).map((t) => t.name) },
    async: { queueable: kind('queueable'), batch: kind('batch'), schedulable: kind('schedulable'), future: withFlag('future') },
    tests: { factories: tests.filter((c) => !c.hasTestMethods).map((c) => c.name), testSetup: withFlag('testSetup', tests), apexMocks: withFlag('apexMocks', [...code, ...tests]), stubApi: withFlag('stubApi', [...code, ...tests]), httpMock: withFlag('httpMock', [...code, ...tests]) },
    classic: {
      strategy: [...impls].filter(([, l]) => l.length >= 2).map(([i, l]) => `${i} → ${l.slice(0, 3).join(', ')}`),
      factory: withFlag('factory'), builder: withFlag('builder'), dto: withFlag('dto'), singleton: withFlag('singleton'), exception: withFlag('exception'), unitOfWork: withFlag('unitOfWork'), logger: withFlag('logger'),
    },
    config: { customMetadata: withFlag('customMetadata'), customSettings: withFlag('customSettings'), labels: withFlag('labels') },
    integration: { callout: withFlag('callout'), namedCredential: withFlag('namedCredential'), restResource: withFlag('restResource') },
    customFields: objects.reduce((n, o) => n + Object.keys(o.fields || {}).filter((f) => /__c$/i.test(f)).length, 0),
  };
}

/** Confirmed teams (config `teams:`), the shared code, word candidates and methods that look the same. */
function teamSummary(model, teamsConfig = []) {
  const t = require('./teams');
  const teams = t.compileTeams(teamsConfig);
  const report = t.teamsReport(model, teams);
  const owned = new Set(report.flatMap((x) => x.classes));
  const shared = Object.values(model.classes || {}).filter((c) => !c.isTest && !/^fflib_/i.test(c.name) && !owned.has(c.name)).map((c) => c.name);
  const helpers = shared.filter((n) => /(Util|Utils|Helper|Helpers|Utility|Common|Shared|Core|Base|Generic)$/i.test(n));
  return {
    teams: report.map((x) => ({ name: x.name, classes: x.classes.length, objects: x.objects.length, fields: x.fields.length, examples: [...x.classes.slice(0, 2), ...x.objects.slice(0, 1)] })),
    candidates: teams.length ? [] : t.suggestTeams(model, teams, { limit: 5 }).map((c) => `${c.word} (${c.total})`),
    shared: shared.length,
    helpers,
    similar: t.similarAcrossTeams(model, { teams }).length,
  };
}

/** The lines of the automatic part, in Portuguese (profile.md is read by the team and by the AI). */
function profileFactLines(f) {
  const c = f.counts;
  const lines = ['## Salesforce (lido do projeto)', ''];
  lines.push(`- Pastas de pacote: ${f.packageDirectories.join(', ') || 'não definidas'}`);
  lines.push(`- Versão da API: ${f.apiVersion || 'não definida'}`);
  lines.push(`- Tamanho: ${c.classes} classes Apex (+ ${c.tests} de teste), ${c.triggers} triggers, ${c.flows} flows, ${c.lwc} LWCs, ${c.objects} objetos (${c.customObjects} customizados)`);
  if (f.fflib) {
    const l = f.layers;
    lines.push(`- Estrutura Apex: fflib (${l.services} services, ${l.selectors} selectors, ${l.domains} domains)`);
  } else {
    lines.push('- Estrutura Apex: sem fflib');
  }
  const other = Object.entries({ controllers: f.layers.controllers, batches: f.layers.batches, queueables: f.layers.queueables }).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`);
  if (other.length) lines.push(`- Outras classes por papel: ${other.join(', ')}`);
  lines.push(f.handlers.count ? `- Trigger handlers: ${f.handlers.count}${f.handlers.bases.length ? `, base mais usada: ${f.handlers.bases.join(', ')}` : ''}` : '- Trigger handlers: nenhum encontrado');
  if (f.testSuffix.length) lines.push(`- Nome das classes de teste: termina com ${f.testSuffix.join(' ou ')}`);
  if (f.sharing.total) lines.push(`- Sharing declarado: ${f.sharing.declared} de ${f.sharing.total} classes`);
  lines.push(...patternLines(f.patterns), ...teamLines(f.teams));
  if (f.parseErrors) lines.push(`- ⚠️ ${f.parseErrors} arquivo(s) não puderam ser lidos (reldor index --json mostra quais)`);
  return lines;
}

/** "Padrões de projeto" lines: only what was found, so the section stays short. */
function patternLines(p) {
  if (!p) return [];
  const out = ['', '## Padrões de projeto (lidos do código)', ''];
  const t = p.triggers;
  if (t.total) out.push(`- Triggers: ${t.objectsWithMany.length ? `mais de uma trigger em ${t.objectsWithMany.join(', ')}` : 'uma por objeto'}; ${t.withLogic.length ? `${t.withLogic.length} com lógica dentro${ex(t.withLogic)}` : 'todas só chamam o handler'}`);
  const a = Object.entries({ Queueable: p.async.queueable, Batch: p.async.batch, Schedulable: p.async.schedulable, '@future': p.async.future }).filter(([, l]) => l.length);
  if (a.length) out.push(`- Assíncrono: ${a.map(([k, l]) => `${l.length} ${k}`).join(', ')}`);
  const tt = p.tests;
  const testBits = [tt.factories.length ? `${tt.factories.length} factory de dados${ex(tt.factories)}` : null, tt.testSetup.length ? `@TestSetup em ${tt.testSetup.length}` : null, tt.apexMocks.length ? `ApexMocks${ex(tt.apexMocks)}` : null, tt.stubApi.length ? `Stub API${ex(tt.stubApi)}` : null, tt.httpMock.length ? `mock de callout${ex(tt.httpMock)}` : null].filter(Boolean);
  if (testBits.length) out.push(`- Testes: ${testBits.join('; ')}`);
  const c = p.classic;
  const names = { factory: 'Factory', builder: 'Builder', dto: 'DTO/Wrapper', singleton: 'Singleton', exception: 'exceções próprias', unitOfWork: 'Unit of Work', logger: 'biblioteca de log' };
  const classic = [c.strategy.length ? `Strategy (interface com várias implementações: ${c.strategy.slice(0, 2).join('; ')})` : null, ...Object.entries(names).filter(([k]) => c[k].length).map(([k, label]) => `${label}: ${c[k].length}${ex(c[k])}`)].filter(Boolean);
  if (classic.length) out.push(`- Padrões: ${classic.join('; ')}`);
  const cfg = Object.entries({ 'Custom Metadata': p.config.customMetadata, 'Custom Settings': p.config.customSettings, 'Custom Labels': p.config.labels }).filter(([, l]) => l.length);
  if (cfg.length) out.push(`- Configuração: ${cfg.map(([k, l]) => `${k} em ${l.length} classes`).join(', ')}`);
  const i = Object.entries({ callouts: p.integration.callout, 'Named Credentials': p.integration.namedCredential, 'APIs REST próprias': p.integration.restResource }).filter(([, l]) => l.length);
  if (i.length) out.push(`- Integração: ${i.map(([k, l]) => `${k} em ${l.length}${ex(l)}`).join(', ')}`);
  out.push(`- Campos customizados: ${p.customFields}`);
  return out.length > 3 ? out : [];
}

/** "Times e código compartilhado" lines. */
function teamLines(t) {
  if (!t) return [];
  const out = ['', '## Times e código compartilhado', ''];
  if (t.teams.length) {
    for (const x of t.teams.slice(0, 8)) out.push(`- ${x.name}: ${x.classes} classes, ${x.objects} objetos, ${x.fields} campos${x.examples.length ? ` (ex.: ${x.examples.join(', ')})` : ''}`);
    out.push(`- Compartilhado (de nenhum time): ${t.shared} classes${t.helpers.length ? `; helpers: ${t.helpers.slice(0, 5).join(', ')}` : ''}`);
  } else {
    out.push('- Times ainda não confirmados: o Reldor não diz de quem é cada classe (reldor teams)');
    if (t.candidates && t.candidates.length) out.push(`- Palavras que se repetem nos nomes (podem ser times): ${t.candidates.join(', ')}`);
    if (t.helpers.length) out.push(`- Helpers: ${t.helpers.slice(0, 5).join(', ')}`);
  }
  if (t.similar) out.push(`- ⚠️ ${t.similar} método(s) com o mesmo nome em ${t.teams.length ? 'times' : 'classes'} diferentes: candidatos a um método genérico (reldor helpers --similar)`);
  out.push('- O seu time fica só na sua máquina: reldor me --team <nome>');
  return out;
}

/** Automatic profile lines for this project (builds or reuses the index). */
function profileAuto(root) {
  const { buildIndex } = require('./indexer');
  const { readProject } = require('./index');
  const { model } = buildIndex(root, {});
  const { loadConfig } = require('../../core/config');
  const facts = profileFacts(model, readProject(root), loadConfig(root).config.teams || []);
  return { facts, lines: profileFactLines(facts) };
}

module.exports = { profileAuto, profileFacts, profileFactLines };
