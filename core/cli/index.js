#!/usr/bin/env node
'use strict';

const { findProjectRoot } = require('../config');
const { statusCommand } = require('./status');
const { initCommand } = require('./init');
const { profileCommand } = require('./profile');
const { meCommand } = require('./me');
const { teamsCommand } = require('./teams');
const { outputCommand } = require('./output');
const { taskCommand } = require('./task');
const { limitsCommand } = require('./limits');
const { setupCommand } = require('./setup');
const { accessCommand } = require('./access');
const { helpersCommand } = require('./helpers');
const { logCommand } = require('./log');
const { indexCommand, explainCommand, usagesCommand, testRadarCommand, checkCommand, refineCommand, xmlCommand, precommitCommand, retrieveCommand, securityCommand, qualityCommand } = require('./sf-commands');
const { snapshotCommand, commitCommand, cleanCommand, hookCommand, mergeCommand, mergeDriverCommand } = require('./git-commands');
const { promoteCommand, collisionsCommand } = require('./promote');
const { rollbackCommand } = require('./rollback');
const { reviewCommand } = require('./review');
const { envCommand } = require('./env');
const { doctorCommand } = require('./doctor');
const { toolsCommand } = require('./tools');
const { deployCommand } = require('./deploy');
const runs = require('../runs');
const pkg = require('../../package.json');

// group: main = the moments of the day (shown first); setup = once per project or person; piece = what the AI and
// review use behind the moments (reldor help --all); internal = called by Git or the hook, never by people.
const COMMANDS = {
  status: { run: statusCommand, group: 'main', help: 'E agora? Onde você está, a tarefa, avisos e o próximo passo' },
  task: { run: taskCommand, group: 'main', help: 'A tarefa atual: número, spec, fase; trocar (use <id>) e onde guardar (output, set)' },
  refine: { run: refineCommand, group: 'main', help: 'Refinar uma task: o que ela toca, o que já existe, o que falta liberar (--file task.md)' },
  explain: { run: explainCommand, group: 'main', help: 'Entender: o que acontece quando um registro é salvo (reldor explain <Objeto>)' },
  usages: { run: usagesCommand, group: 'main', help: 'Entender: onde algo é usado, antes de mudar ou apagar' },
  access: { run: accessCommand, group: 'main', help: 'Já existe, mas está liberado? Onde falta liberar um campo, valor, objeto ou classe' },
  helpers: { run: helpersCommand, group: 'main', help: 'Antes de criar um método: o que já existe, e o que se repete entre times (--similar)' },
  limits: { run: limitsCommand, group: 'main', help: 'Limites: campos, relacionamentos, roll-ups e regras por objeto; --org lê os limites da org' },
  review: { run: reviewCommand, group: 'main', help: 'Revisar antes do commit: segurança, qualidade, queries, testes e XML de uma vez' },
  commit: { run: commitCommand, group: 'main', help: 'Separar o seu do que veio da org e entregar os comandos (-m, --stash-org, --undo, --dry-run)' },
  deploy: { run: deployCommand, group: 'main', help: 'Montar os comandos de validação e de deploy dos seus arquivos (não executa)' },
  merge: { run: mergeCommand, group: 'main', help: 'Merge assistido na branch de merge (reldor merge <sua-branch>, --resolve, --check, --continue)' },
  promote: { run: promoteCommand, group: 'main', help: 'Ensaio de promoção: ordem dos commits e dependências antes da PR' },
  rollback: { run: rollbackCommand, group: 'main', help: 'Plano de rollback de uma PR (não altera nada)' },
  setup: { run: setupCommand, group: 'setup', help: 'Instala e prepara o Kiro com um comando: MCP e PATH dos terminais do Kiro, sem mexer no Windows' },
  doctor: { run: doctorCommand, group: 'setup', help: 'Confere a instalação e a pasta do terminal' },
  init: { run: initCommand, group: 'setup', help: 'Configura o Reldor no projeto, sem perguntas' },
  env: { run: envCommand, group: 'setup', help: 'Ambientes e org (set "nome:branch, ...", --org <alias>, --org-for "nome:alias")' },
  me: { run: meCommand, group: 'setup', help: 'O seu time, só na sua máquina (--team <nome>)' },
  output: { run: outputCommand, group: 'setup', help: 'As respostas guardadas em .reldor/work/output (--clear apaga agora)' },
  teams: { run: teamsCommand, group: 'setup', help: 'Times do projeto: sugestões e confirmação (add <nome> --match <palavra>, --regex, --folder)' },
  tools: { run: toolsCommand, group: 'setup', help: 'Ferramentas do time: o que o Reldor só confere ou deixa com elas' },
  hook: { run: hookCommand, group: 'setup', help: 'Gancho pre-commit do Reldor (install | uninstall)' },
  profile: { run: profileCommand, group: 'piece', help: 'Atualiza o profile.md com o que está no projeto hoje' },
  'test-radar': { run: testRadarCommand, group: 'piece', help: 'Testes afetados (--run monta o comando; --result <arquivo> lê o resultado)' },
  security: { run: securityCommand, group: 'piece', help: 'Só a parte de segurança da revisão' },
  quality: { run: qualityCommand, group: 'piece', help: 'Só a parte de qualidade e código repetido da revisão' },
  check: { run: checkCommand, group: 'piece', help: 'Só a checagem de queries (campo lido fora da SOQL/Selector)' },
  xml: { run: xmlCommand, group: 'piece', help: 'Ordena e tira duplicados de profiles, permission sets, labels... (--check, --all)' },
  retrieve: { run: retrieveCommand, group: 'piece', help: 'Monta o retrieve da org certa e a foto para o commit limpo' },
  snapshot: { run: snapshotCommand, group: 'piece', help: 'Foto depois de um retrieve feito fora do Reldor (--clear, --restore)' },
  index: { run: indexCommand, group: 'piece', help: 'Monta ou atualiza o índice do projeto (--full)' },
  log: { run: logCommand, group: 'piece', help: 'Histórico do que o Reldor fez' },
  collisions: { run: collisionsCommand, group: 'piece', help: 'PRs abertas que mexem nos seus arquivos (precisa do GitHub CLI)' },
  clean: { run: cleanCommand, group: 'internal', help: 'O mesmo que reldor commit --stash-org' },
  precommit: { run: precommitCommand, group: 'internal', help: 'Checagem usada pelo gancho pre-commit' },
  'merge-driver': { run: mergeDriverCommand, group: 'internal', help: 'Uso interno do Git (merge item a item)' },
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
    if (/^-[a-z]$/i.test(token)) {
      flags[token.slice(1)] = rest[i + 1] !== undefined && !rest[i + 1].startsWith('-') ? rest[++i] : true;
      continue;
    }
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

/**
 * The "command started / finished" marks that IDE terminals use (VS Code shell integration, OSC 633). A terminal
 * without that integration (cmd, a restricted PowerShell) never says a command ended, so the IDE's AI waits; the
 * Reldor says it itself. Invisible on screen; only in an IDE terminal; RELDOR_NO_TERMINAL_SIGNAL=1 turns it off.
 */
function terminalSignal(mark) {
  if (!process.stdout.isTTY || process.env.RELDOR_NO_TERMINAL_SIGNAL || !/vscode|kiro/i.test(`${process.env.TERM_PROGRAM || ''}`)) return;
  try {
    process.stdout.write(`\x1b]633;${mark}\x07`);
  } catch {
    /* never fail a command for this */
  }
}

function help(all = false) {
  const group = (g) => Object.entries(COMMANDS).filter(([, c]) => c.group === g).map(([name, c]) => `  reldor ${name.padEnd(10)} ${c.help}`);
  const lines = [
    `🛡️  Reldor ${pkg.version} — o guardião do desenvolvimento`,
    '',
    'Você não precisa decorar comandos: peça à sua IA, por exemplo "quero usar o Reldor".',
    '',
    'O dia a dia:',
    ...group('main'),
    '',
    'Configurar (uma vez):',
    ...group('setup'),
    '',
    ...(all ? ['Peças por trás deles (a IA e o review usam):', ...group('piece')] : ['Peças que a IA usa por trás: reldor help --all']),
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
    help(Boolean(flags.all));
    return 0;
  }
  const entry = COMMANDS[command];
  if (!entry) {
    process.stderr.write(`⚠️ Comando desconhecido: ${command}. Rode "reldor help".\n`);
    return 1;
  }
  const root = findProjectRoot(flags.cwd || process.cwd());
  runs.setFresh(Boolean(flags.fresh));
  if (typeof flags.out === 'string') {
    const fs = require('node:fs');
    fs.rmSync(require('node:path').resolve(flags.out), { force: true });
    require('../report').setOut(flags.out);
  }
  // Everything the command writes is also kept, to be saved in .reldor/work/output/ (see core/output).
  const captured = [];
  const writes = [process.stdout.write, process.stderr.write];
  if (typeof flags.out !== 'string') {
    for (const stream of [process.stdout, process.stderr]) {
      const original = stream.write;
      stream.write = function tee(chunk, ...rest) {
        captured.push(String(chunk));
        return original.call(stream, chunk, ...rest);
      };
    }
  }
  terminalSignal('C');
  let code = 1;
  try {
    code = await entry.run(root, flags, args);
    return code;
  } finally {
    [process.stdout.write, process.stderr.write] = writes;
    require('../report').finishOut();
    if (captured.length) require('../output').saveOutput(root, command, captured.join(''), { json: Boolean(flags.json) });
    terminalSignal(`D;${code || 0}`);
  }
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
