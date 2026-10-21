'use strict';

/**
 * reldor helpers [termo] [--similar] [--json]
 * Before writing a method: the public methods that already exist, shared code first. With --similar: methods with the
 * same name in different teams, candidates for one generic method in shared code.
 */
const { readLocal } = require('../config');
const { print, printJson } = require('../report');

async function helpersCommand(root, flags, args) {
  const { readProject } = require('../../modules/sf');
  if (!readProject(root)) {
    process.stderr.write('⚠️ sfdx-project.json não encontrado: rode o comando dentro de um projeto Salesforce.\n');
    return 1;
  }
  const { buildIndex } = require('../../modules/sf/indexer');
  const t = require('../../modules/sf/teams');
  const { model } = buildIndex(root, {});
  const me = readLocal(root);
  const teams = t.teamPrefixes(model, { known: me.prefix ? [me.prefix] : [] });
  const term = args.join(' ').trim();
  const sig = (h) => `${h.className}.${h.method}(${h.params.join(', ')})${h.returns && h.returns !== 'void' ? ` → ${h.returns}` : ''}`;

  if (flags.similar) {
    const groups = t.similarAcrossTeams(model, { teams });
    if (flags.json) {
      printJson({ similar: groups });
      return 0;
    }
    const out = ['\n🛡️  Métodos com o mesmo nome em times diferentes', ''];
    if (!groups.length) out.push('Nenhum. Cada time está usando métodos diferentes (ou já usa o compartilhado).');
    for (const g of groups) out.push(`• ${g.method} (${g.owners.join(', ')}):`, ...g.where.map((w) => `   ${w}`));
    if (groups.length) out.push('', '💡 Cada grupo pode virar um método só, genérico (recebendo por parâmetro o que muda), numa classe compartilhada.');
    print(out);
    return 0;
  }

  const hits = t.searchHelpers(model, term, { teams });
  if (flags.json) {
    printJson({ term: term || null, team: me.prefix || null, results: hits.map((h) => ({ ...h, signature: sig(h) })) });
    return 0;
  }
  const out = [`\n🛡️  ${term ? `Métodos que já existem para "${term}"` : 'Métodos públicos do código compartilhado'}`, ''];
  if (!hits.length) out.push(term ? 'Nada encontrado. Se for criar, pense num método genérico numa classe compartilhada (sem prefixo de time).' : 'Nenhum método público em classes compartilhadas.');
  const shared = hits.filter((h) => h.shared);
  const others = hits.filter((h) => !h.shared);
  if (shared.length) out.push('Compartilhado (use direto):', ...shared.slice(0, 20).map((h) => `   ${sig(h)}   ${h.file}:${h.line}`));
  if (others.length) out.push('', 'Em classes de times (reaproveitar pode pedir levar para o compartilhado):', ...others.slice(0, 20).map((h) => `   ${sig(h)}   [${h.owner}]`));
  print(out);
  return 0;
}

module.exports = { helpersCommand };
