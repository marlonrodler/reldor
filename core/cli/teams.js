'use strict';

/**
 * reldor teams [--json]                                       the confirmed teams and the word suggestions
 * reldor teams add <nome> --match <palavra> [--where start|end|anywhere] | --regex <expressão> | --folder <pasta>
 * reldor teams remove <nome>
 * How a name shows its team is different in each company, so the Reldor only uses what someone confirmed here.
 * Saved in the project config (`teams:`), for the whole team.
 */
const { loadConfig, readRawConfig, saveConfig } = require('../config');
const { logAction } = require('../log');
const { print, printJson } = require('../report');

async function teamsCommand(root, flags, args) {
  const raw = readRawConfig(root);
  const list = Array.isArray(raw.teams) ? raw.teams : [];
  if (args[0] === 'add') {
    const name = args[1];
    const entry = { name };
    if (typeof flags.regex === 'string') entry.regex = flags.regex;
    else if (typeof flags.folder === 'string') entry.folder = flags.folder;
    else if (typeof flags.match === 'string') {
      entry.match = flags.match;
      if (['start', 'end'].includes(flags.where)) entry.where = flags.where;
    }
    if (!name || Object.keys(entry).length < 2) {
      print('⚠️ Use: reldor teams add <nome> --match <palavra> [--where start|end] (ou --regex <expressão>, ou --folder <pasta>)');
      return 1;
    }
    if (entry.regex) {
      try {
        new RegExp(entry.regex);
      } catch {
        print('⚠️ A expressão regular não é válida.');
        return 1;
      }
    }
    raw.teams = [...list.filter((t) => t.name !== name), entry];
    saveConfig(root, raw);
    logAction(root, 'teams', { summary: `time ${name} confirmado` });
  } else if (args[0] === 'remove') {
    raw.teams = list.filter((t) => t.name !== args[1]);
    saveConfig(root, raw);
  }

  const { config } = loadConfig(root);
  const t = require('../../modules/sf/teams');
  const { readProject } = require('../../modules/sf');
  const teams = t.compileTeams(config.teams);
  let report = [];
  let suggestions = [];
  if (readProject(root)) {
    const { model } = require('../../modules/sf/indexer').buildIndex(root, {});
    report = t.teamsReport(model, teams).map((x) => ({ name: x.name, classes: x.classes.length, objects: x.objects.length, fields: x.fields.length, examples: x.classes.slice(0, 3) }));
    suggestions = t.suggestTeams(model, teams);
  }
  if (flags.json) {
    printJson({ teams: config.teams || [], found: report, suggestions });
    return 0;
  }
  const out = ['\n🛡️  Times do projeto (confirmados; valem para o time todo)', ''];
  if (!report.length) out.push('Nenhum time confirmado: o Reldor não diz de quem é cada classe.');
  for (const r of report) out.push(`• ${r.name}: ${r.classes} classes, ${r.objects} objetos, ${r.fields} campos${r.examples.length ? ` (ex.: ${r.examples.join(', ')})` : ''}`);
  if (suggestions.length) {
    out.push('', 'Palavras que se repetem nos nomes (podem ser times; confirme só as que forem):');
    for (const s of suggestions) out.push(`   • ${s.word}: ${s.total} nomes${s.where !== 'anywhere' ? ` (sempre no ${s.where === 'start' ? 'começo' : 'fim'})` : ''}, ex.: ${s.examples.join(', ')}`);
    out.push('', 'Para confirmar: reldor teams add <nome> --match <palavra> [--where start|end]  ·  ou --regex, ou --folder');
  }
  print(out);
  return 0;
}

module.exports = { teamsCommand };
