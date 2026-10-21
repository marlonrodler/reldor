#!/usr/bin/env node
'use strict';

const { findProjectRoot } = require('../config');
const { statusCommand } = require('./status');
const { initCommand } = require('./init');
const { profileCommand } = require('./profile');
const { meCommand } = require('./me');
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

// main: the moments people use (shown first). detail: the pieces behind them, still available.
const COMMANDS = {
  status: { run: statusCommand, main: true, help: 'E agora? Onde você está, avisos e o próximo passo (--json, --fetch)' },
  explain: { run: explainCommand, main: true, help: 'Entender: o que acontece quando um registro é salvo (reldor explain <Objeto>)' },
  usages: { run: usagesCommand, main: true, help: 'Entender: onde algo é usado, antes de mudar ou apagar' },
  refine: { run: refineCommand, main: true, help: 'Entender: fatos para escrever uma task (reldor refine "<ideia>", ou --file task.md; --objects, --fields, --values "Obj.Campo=Valor")' },
  review: { run: reviewCommand, main: true, help: 'Revisar antes do commit: segurança, qualidade, queries, testes e XML de uma vez' },
  clean: { run: cleanCommand, main: true, help: 'Limpar antes do commit: deixa na pasta só o seu (--dry-run, --undo)' },
  merge: { run: mergeCommand, main: true, help: 'Merge assistido na branch de merge: reldor merge <sua-branch> (--check, --continue, --abort)' },
  promote: { run: promoteCommand, main: true, help: 'Subir: ensaio para um ambiente (ordem dos commits, dependências)' },
  deploy: { run: deployCommand, main: true, help: 'Subir: monta os comandos de validação e de deploy dos seus arquivos (não executa)' },
  rollback: { run: rollbackCommand, main: true, help: 'Desfazer: plano de rollback de uma PR (não altera nada)' },
  tools: { run: toolsCommand, help: 'Ferramentas do time: quem cuida de cada coisa, para o Reldor não repetir (set <capacidade> run|verify|skip)' },
  doctor: { run: doctorCommand, help: 'Confere a instalação e a pasta do terminal, e diz o próximo passo (--json)' },
  env: { run: envCommand, help: 'Cadeia de ambientes e org: ver e mudar (set "nome:branch, ...", --org <alias>, --org-for "nome:alias", --base, --production)' },
  init: { run: initCommand, help: 'Configura o Reldor neste projeto, sem perguntas (opcionais: --envs, --org, --design-system, --execute on|off)' },
  access: { run: accessCommand, main: true, help: 'Já existe, mas está liberado? Onde falta liberar um campo, valor de picklist, objeto ou classe (--value, --rt, --perms)' },
  me: { run: meCommand, help: 'O seu time, só na sua máquina (--team <nome> --prefix <PREFIXO>)' },
  helpers: { run: helpersCommand, help: 'Antes de criar um método: o que já existe (termo), e métodos iguais em times diferentes (--similar)' },
  profile: { run: profileCommand, help: 'Atualiza o profile.md com o que está no projeto hoje (a parte do time fica como está)' },
  log: { run: logCommand, help: 'Histórico de ações do Reldor (--json)' },
  index: { run: indexCommand, help: 'Monta ou atualiza o índice do projeto (--full, --json)' },
  'test-radar': { run: testRadarCommand, help: 'Testes afetados pelas mudanças (--run --org <alias> roda sem salvar)' },
  security: { run: securityCommand, help: 'Só a parte de segurança da revisão (--all, --no-analyzer, --fail-on)' },
  quality: { run: qualityCommand, help: 'Só a parte de qualidade e código repetido da revisão (--all, --no-analyzer)' },
  check: { run: checkCommand, help: 'Só a checagem de queries (campo lido fora da SOQL/Selector)' },
  xml: { run: xmlCommand, help: 'Ordena e remove duplicados em profiles, permission sets, labels... (--all, --check)' },
  retrieve: { run: retrieveCommand, help: 'Retrieve com confirmação da org e foto para o clean (--metadata, --manifest, --org)' },
  snapshot: { run: snapshotCommand, help: 'Foto depois de um retrieve feito fora do Reldor (--clear para apagar)' },
  commit: { run: commitCommand, help: 'Commit limpo: separa só as suas linhas e entrega os comandos (-m, --include, --dry-run)' },
  hook: { run: hookCommand, help: 'Gancho pre-commit do Reldor (install | uninstall)' },
  precommit: { run: precommitCommand, help: 'Checagem usada pelo gancho pre-commit', hidden: true },
  collisions: { run: collisionsCommand, help: 'Radar de colisão (opcional): PRs abertas que mexem nos seus arquivos', hidden: true },
  'merge-driver': { run: mergeDriverCommand, help: 'Uso interno do Git (chamado pelo merge inteligente)', hidden: true },
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

function help() {
  const lines = [
    `🛡️  Reldor ${pkg.version} — o guardião do desenvolvimento`,
    '',
    'Você não precisa decorar comandos: peça à sua IA, por exemplo "quero usar o Reldor".',
    '',
    'Os momentos:',
    ...Object.entries(COMMANDS).filter(([, c]) => c.main).map(([name, c]) => `  reldor ${name.padEnd(10)} ${c.help}`),
    '',
    'Peças por trás deles (a IA usa quando precisa):',
    ...Object.entries(COMMANDS).filter(([, c]) => !c.main && !c.hidden).map(([name, c]) => `  reldor ${name.padEnd(10)} ${c.help}`),
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
  runs.setFresh(Boolean(flags.fresh));
  if (typeof flags.out === 'string') {
    const fs = require('node:fs');
    fs.rmSync(require('node:path').resolve(flags.out), { force: true });
    require('../report').setOut(flags.out);
  }
  try {
    return await entry.run(root, flags, args);
  } finally {
    require('../report').finishOut();
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
