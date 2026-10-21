'use strict';

/**
 * reldor limits [Objeto,...] [--org <alias>] [--all] [--json]
 * Limits counted from the project (per object), and with --org the org's own limits (read-only, runs directly).
 */
const { loadConfig } = require('../config');
const { logAction } = require('../log');
const { print, printJson } = require('../report');

async function limitsCommand(root, flags, args) {
  const { readProject } = require('../../modules/sf');
  if (!readProject(root)) {
    process.stderr.write('⚠️ sfdx-project.json não encontrado: rode o comando dentro de um projeto Salesforce.\n');
    return 1;
  }
  const { config } = loadConfig(root);
  const { buildIndex } = require('../../modules/sf/indexer');
  const L = require('../../modules/sf/limits');
  const { model } = buildIndex(root, {});
  const objects = args.length ? args.join(',').split(',').map((x) => x.trim()).filter(Boolean) : null;
  const r = L.limitsReport(model, config, { objects });
  const items = flags.all || objects ? r.items : r.items.filter((i) => i.near);
  let org = null;
  if (typeof flags.org === 'string') org = L.orgLimits(root, flags.org);
  logAction(root, 'limits', { summary: `${r.items.filter((i) => i.near).length} perto do limite${org ? `; org: ${org.ok ? org.near.length : 'erro'}` : ''}` });
  if (flags.json) {
    printJson({ edition: r.edition, items, org });
    return 0;
  }
  const out = [`\n🛡️  Limites (pelo projeto, edição ${r.edition}; mude com org.edition na configuração)`, ''];
  if (!items.length) out.push(objects ? 'Nada contado para esses objetos.' : '✅ Nenhum objeto a 80% ou mais de um limite (pelo que está no projeto).');
  for (const i of items.slice(0, 40)) out.push(`${i.near ? '⚠️' : '•'} ${i.object}: ${i.what} ${i.used} de ${i.limit} (${i.pct}%)`);
  out.push('', 'ℹ️  Conta o que está no projeto: a org pode ter mais (o que não veio no retrieve). Campos de pacotes gerenciados têm cota própria.');
  if (org) {
    out.push('', `Limites da org ${flags.org} (sf org list limits, só leitura):`);
    if (!org.ok) out.push(`   ⚠️ ${org.error}`);
    else if (!org.near.length) out.push(`   ✅ Nenhum dos ${org.total} limites a 80% ou mais.`);
    else out.push(...org.near.map((l) => `   ⚠️ ${l.name}: ${l.used} de ${l.limit} (${l.pct}%)`));
  } else out.push('ℹ️  Para os limites da própria org (API, armazenamento...): reldor limits --org <alias>');
  print(out);
  return 0;
}

module.exports = { limitsCommand };
