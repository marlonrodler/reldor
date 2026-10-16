'use strict';

const { loadConfig } = require('../config');
const { logAction } = require('../log');
const { print, printJson } = require('../report');
const { buildIndex } = require('../../modules/sf/indexer');
const { explainObject, renderExplain, EVENTS } = require('../../modules/sf/explain');
const { findUsages, renderUsages } = require('../../modules/sf/checks/usages');

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

module.exports = { indexCommand, explainCommand, usagesCommand, loadConfig };
