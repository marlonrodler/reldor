'use strict';

/**
 * reldor me [--team <nome>] [--prefix <PREFIXO>] [--json]
 * The person's own team, saved only on this machine (.reldor/local.yaml, out of Git). With a team prefix, shows what
 * belongs to the team in the project and what is shared, so the AI follows the team's pattern and reuses shared code.
 */
const { readLocal, saveLocal } = require('../config');
const { logAction } = require('../log');
const { print, printJson } = require('../report');

async function meCommand(root, flags) {
  const before = readLocal(root);
  let changed = false;
  const next = { ...before };
  for (const key of ['team', 'prefix']) {
    if (typeof flags[key] === 'string' && flags[key].trim()) {
      next[key] = key === 'prefix' ? flags[key].trim().replace(/_+$/, '') : flags[key].trim();
      changed = true;
    }
  }
  if (changed) {
    saveLocal(root, next);
    logAction(root, 'me', { summary: `time ${next.team || '?'} (${next.prefix || 'sem prefixo'})` });
  }

  const { readProject } = require('../../modules/sf');
  let found = null;
  let suggestions = [];
  if (readProject(root)) {
    const { buildIndex } = require('../../modules/sf/indexer');
    const teams = require('../../modules/sf/teams');
    const { model } = buildIndex(root, {});
    const list = teams.teamPrefixes(model, { known: next.prefix ? [next.prefix] : [] });
    suggestions = list.slice(0, 6).map((t) => ({ prefix: t.spelling, classes: t.classes.length, objects: t.objects.length, fields: t.fields.length }));
    const mine = next.prefix ? list.find((t) => t.prefix === next.prefix.toUpperCase()) : null;
    if (mine) found = { prefix: mine.spelling, classes: mine.classes, objects: mine.objects, fields: mine.fields.length };
  }

  if (flags.json) {
    printJson({ team: next.team || null, prefix: next.prefix || null, saved: changed, file: '.reldor/local.yaml', found, prefixes: suggestions });
    return 0;
  }
  const out = ['\n🛡️  Seu time (só nesta máquina, fora do Git)', ''];
  if (!next.team && !next.prefix) {
    out.push('Ainda não sei qual é o seu time.');
    if (suggestions.length) out.push('', 'Prefixos que aparecem no projeto:', ...suggestions.map((s) => `   • ${s.prefix}_: ${s.classes} classes, ${s.objects} objetos, ${s.fields} campos`));
    out.push('', 'Para dizer: reldor me --team <nome> --prefix <PREFIXO>');
    print(out);
    return 0;
  }
  out.push(`• Time: ${next.team || '(sem nome)'}${next.prefix ? ` · prefixo ${next.prefix}_` : ''}`);
  if (found) {
    out.push(`• No projeto: ${found.classes.length} classes, ${found.objects.length} objetos, ${found.fields} campos com ${found.prefix}_`);
    if (found.classes.length) out.push(`• Exemplos do padrão do time: ${found.classes.slice(0, 4).join(', ')}`);
  } else if (next.prefix) out.push(`• Nada com ${next.prefix}_ no projeto ainda.`);
  out.push('• O que não tem prefixo de time é compartilhado: antes de criar um método, procure lá (reldor helpers <termo>).');
  if (changed) out.push('', '✅ Salvo em .reldor/local.yaml (está no .gitignore: não vai para o repositório).');
  print(out);
  return 0;
}

module.exports = { meCommand };
