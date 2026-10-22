'use strict';

/**
 * reldor me [--team <nome>] [--json]
 * The person's own team, saved only on this machine (.reldor/local.yaml, out of Git). The teams themselves (how a name
 * shows its team) are confirmed for the whole project with `reldor teams`.
 */
const { readLocal, saveLocal, loadConfig } = require('../config');
const { logAction } = require('../log');
const { print, printJson } = require('../report');

async function meCommand(root, flags) {
  const before = readLocal(root);
  const next = { ...before };
  let changed = false;
  if (typeof flags.team === 'string' && flags.team.trim()) {
    next.team = flags.team.trim();
    delete next.prefix;
    changed = true;
    saveLocal(root, next);
    logAction(root, 'me', { summary: `time ${next.team}` });
  }
  const { config } = loadConfig(root);
  const confirmed = (config.teams || []).map((t) => t.name);
  const known = next.team ? confirmed.find((n) => n.toLowerCase() === next.team.toLowerCase()) : null;
  if (flags.json) {
    printJson({ team: next.team || null, saved: changed, file: '.reldor/local.yaml', teamConfirmed: Boolean(known), teams: confirmed });
    return 0;
  }
  const out = ['\n🛡️  Seu time (só nesta máquina, fora do Git)', ''];
  if (!next.team) out.push('Ainda não sei qual é o seu time. Para dizer: reldor me --team <nome>');
  else out.push(`• Time: ${next.team}`);
  if (next.team && !known) out.push(confirmed.length ? `⚠️ "${next.team}" não está entre os times do projeto (${confirmed.join(', ')}). Para incluir: reldor teams add ${next.team} --match <palavra>` : 'ℹ️  O projeto ainda não tem times confirmados: veja as sugestões com reldor teams.');
  if (changed) out.push('', '✅ Salvo em .reldor/local.yaml (está no .gitignore: não vai para o repositório).');
  print(out);
  return 0;
}

module.exports = { meCommand };
