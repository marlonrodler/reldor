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
function profileFacts(model, project) {
  const classes = Object.values(model.classes || {});
  const tests = classes.filter((c) => c.isTest);
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
  if (f.prefixes.length) lines.push(`- Prefixos de nome mais comuns: ${f.prefixes.join(', ')}`);
  if (f.sharing.total) lines.push(`- Sharing declarado: ${f.sharing.declared} de ${f.sharing.total} classes`);
  if (f.parseErrors) lines.push(`- ⚠️ ${f.parseErrors} arquivo(s) não puderam ser lidos (reldor index --json mostra quais)`);
  return lines;
}

/** Automatic profile lines for this project (builds or reuses the index). */
function profileAuto(root) {
  const { buildIndex } = require('./indexer');
  const { readProject } = require('./index');
  const { model } = buildIndex(root, {});
  const facts = profileFacts(model, readProject(root));
  return { facts, lines: profileFactLines(facts) };
}

module.exports = { profileAuto, profileFacts, profileFactLines };
