'use strict';

const { readActions } = require('../log');
const { title, print, printJson } = require('../report');

function logCommand(root, flags) {
  const actions = readActions(root, Number(flags.limit) || 20);
  if (flags.json) {
    printJson(actions);
    return 0;
  }
  if (!actions.length) {
    print([title('Reldor · histórico'), 'Nenhuma ação registrada ainda.']);
    return 0;
  }
  print([
    title('Reldor · histórico (mais recentes primeiro)'),
    ...actions.map((a) => `• ${a.at.replace('T', ' ').slice(0, 19)}  ${a.action}${a.summary ? ` — ${a.summary}` : ''}`),
  ]);
  return 0;
}

module.exports = { logCommand };
