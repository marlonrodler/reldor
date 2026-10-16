'use strict';

/**
 * Flow-level security: a way in (screen, API or flow) that reaches, through the call chain,
 * a "without sharing" class that reads or writes data. A file-by-file scanner does not see this path.
 */
const { chainFrom } = require('../indexer/query');

function pathFindings(model, classNames) {
  const out = [];
  for (const name of classNames) {
    const entry = model.classes[name];
    if (!entry || entry.isTest || !entry.exposed) continue;
    const chain = chainFrom(model, entry, name, 3);
    for (const c of chain) {
      const cls = model.classes[c.name];
      if (!cls || cls.sharing !== 'without sharing') continue;
      if (!cls.soql.length && !cls.dml.length) continue;
      out.push({
        rule: 'caminho-sem-sharing',
        severity: 'média',
        file: entry.file,
        line: 1,
        source: 'reldor',
        message: `${name} (chamada de fora) chega em ${c.name}, que é "without sharing" e ${cls.dml.length ? 'grava' : 'lê'} dados: o usuário pode ver ou alterar registros que não deveria.`,
        fix: `Confirme se ${c.name} precisa mesmo ignorar o compartilhamento. Se não, use "inherited sharing"; se sim, filtre os registros pelo usuário antes de devolver.`,
        path: [name, ...chain.slice(0, chain.indexOf(c) + 1).filter((x) => x.level <= c.level).map((x) => x.name)],
      });
    }
  }
  return out;
}

module.exports = { pathFindings };
