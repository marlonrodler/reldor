#!/usr/bin/env node
'use strict';

const { findProjectRoot } = require('../config');
const { statusCommand } = require('./status');
const { initCommand } = require('./init');
const { logCommand } = require('./log');
const { indexCommand, explainCommand, usagesCommand } = require('./sf-commands');
const pkg = require('../../package.json');

const COMMANDS = {
  status: { run: statusCommand, help: 'Mostra a etapa atual e o próximo passo (--json, --fetch)' },
  init: { run: initCommand, help: 'Configura o Reldor neste projeto (--yes, --envs, --org, --design-system)' },
  log: { run: logCommand, help: 'Mostra o histórico de ações do Reldor (--json)' },
  index: { run: indexCommand, help: 'Monta ou atualiza o índice do projeto (--full, --json)' },
  explain: { run: explainCommand, help: 'O que acontece quando um registro é salvo: reldor explain <Objeto> [--event insert|update|delete]' },
  usages: { run: usagesCommand, help: 'Onde algo é usado: reldor usages <Classe | Classe.metodo | Objeto.Campo__c | Objeto>' },
};

/** Parses `cmd --flag value --bool` into { command, flags, args }. */
function parseArgs(argv) {
  const startsWithFlag = argv.length > 0 && argv[0].startsWith('--');
  const command = startsWithFlag ? undefined : argv[0];
  const rest = startsWithFlag ? argv : argv.slice(1);
  const flags = {};
  const args = [];
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) {
      args.push(token);
      continue;
    }
    const [key, inline] = token.slice(2).split('=', 2);
    if (inline !== undefined) flags[key] = inline;
    else if (rest[i + 1] !== undefined && !rest[i + 1].startsWith('--')) flags[key] = rest[++i];
    else flags[key] = true;
  }
  return { command, flags, args };
}

function help() {
  const lines = [
    `🛡️  Reldor ${pkg.version} — o guardião do desenvolvimento`,
    '',
    'Você não precisa decorar comandos: peça à sua IA, por exemplo "quero usar o Reldor".',
    '',
    'Comandos:',
    ...Object.entries(COMMANDS).map(([name, c]) => `  reldor ${name.padEnd(8)} ${c.help}`),
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

async function main(argv = process.argv.slice(2)) {
  const { command, flags, args } = parseArgs(argv);
  if (command === 'version' || flags.version) {
    process.stdout.write(pkg.version + '\n');
    return 0;
  }
  if (!command || command === 'help' || flags.help) {
    help();
    return 0;
  }
  const entry = COMMANDS[command];
  if (!entry) {
    process.stderr.write(`⚠️ Comando desconhecido: ${command}. Rode "reldor help".\n`);
    return 1;
  }
  const root = findProjectRoot(flags.cwd || process.cwd());
  return entry.run(root, flags, args);
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code || 0;
    })
    .catch((error) => {
      process.stderr.write(`⚠️ ${error.message}\n`);
      process.exitCode = 1;
    });
}

module.exports = { main, parseArgs };
