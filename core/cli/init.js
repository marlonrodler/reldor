'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');

const gitApi = require('../git');
const { DEFAULTS, paths, loadConfig, saveConfig } = require('../config');
const { detectModules } = require('../modules');
const { findSpecs } = require('../spec');
const { logAction } = require('../log');
const { title, print } = require('../report');

const GITIGNORE_LINES = ['.reldor/cache/', '.reldor/work/', '.reldor/log/'];

/** Guesses a friendly environment name from a branch name. */
function envName(branch, index, total) {
  const b = branch.toLowerCase();
  if (/(^|\/)(master|main)$/.test(b) || index === total - 1) return 'producao';
  if (b.includes('uat') || b.includes('hml') || b.includes('homolog')) return 'uat';
  if (b.startsWith('dev') || b.includes('develop')) return 'develop';
  return branch.split('/').pop();
}

/** Accepts "develop,rc/uat,master" or "develop:develop/x,uat:rc/uat/x,producao:master". */
function parseEnvs(value) {
  const parts = String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((part, i) => {
    const [maybeName, maybeBranch] = part.includes(':') ? part.split(':', 2) : [null, part];
    const branch = maybeBranch.trim();
    const name = maybeName ? maybeName.trim() : envName(branch, i, parts.length);
    const env = { name, branch };
    if (i === parts.length - 1) env.deploy = 'blocked';
    return env;
  });
}

/** Suggests the environment chain from the branches that exist. */
function suggestEnvs(branches) {
  const pick = (test) => branches.find(test);
  const dev = pick((b) => /^develop(\/|$)/i.test(b)) || pick((b) => /^dev(\/|$)/i.test(b));
  const uat = pick((b) => /uat|hml|homolog/i.test(b));
  const prod = pick((b) => /^(master|main)$/i.test(b));
  return [dev, uat, prod].filter(Boolean);
}

function ensureGitignore(root) {
  const file = path.join(root, '.gitignore');
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const missing = GITIGNORE_LINES.filter((l) => !current.split(/\r?\n/).includes(l));
  if (!missing.length) return false;
  const prefix = current && !current.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(file, `${prefix}\n# Reldor (arquivos locais)\n${missing.join('\n')}\n`, 'utf8');
  return true;
}

function writeProfile(root, { modules, designSystem, specs }) {
  const lines = [
    '# Perfil do projeto',
    '',
    'Gerado pelo `reldor init`. Revise e ajuste: este arquivo é versionado e vale para o time todo.',
    '',
    `- Design system de telas: ${designSystem}`,
    `- Specs encontradas: ${specs.length ? specs.map((s) => s.path).join(', ') : 'nenhuma'}`,
    '',
  ];
  for (const { mod, facts } of modules) lines.push(...mod.profileLines(facts), '');
  lines.push(
    '## Padrões da equipe',
    '',
    '<!-- Descreva aqui: prefixos por time, classes compartilhadas, critérios Flow x Apex, regras de nomes. -->',
    '',
  );
  fs.writeFileSync(paths(root).profile, lines.join('\n'), 'utf8');
}

async function ask(rl, question, fallback) {
  if (!rl) return fallback;
  const answer = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ''}: `)).trim();
  return answer || fallback;
}

async function initCommand(root, flags) {
  const out = [title('Reldor · configuração')];
  const existing = loadConfig(root);
  if (existing.exists && !flags.force) {
    print([...out, '✅ O Reldor já está configurado neste projeto.', `• Arquivo: ${path.relative(root, existing.file)}`, '• Para refazer, rode: reldor init --force']);
    return 0;
  }

  const repo = gitApi.isRepo(root);
  if (!repo) out.push('⚠️ Esta pasta não é um repositório Git. O status de ambientes ficará desligado.');

  const modules = detectModules(root).map((mod) => ({ mod, facts: mod.detect(root, { skipCli: Boolean(flags['no-cli']) }) }));
  const sf = modules.find((m) => m.mod.name === 'sf');
  const specs = findSpecs(root, DEFAULTS);
  const branches = repo ? gitApi.listBranches(root) : [];

  out.push('Detectei:');
  out.push(sf ? '• Projeto Salesforce (sfdx-project.json)' : '• Nenhum projeto Salesforce (sfdx-project.json ausente)');
  if (sf) out.push(...sf.mod.statusLines(sf.facts));
  out.push(`• Specs: ${specs.length ? specs.length + ' encontrada(s)' : 'nenhuma'}`);
  print(out);

  const interactive = !flags.yes && process.stdin.isTTY;
  const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;

  try {
    const suggested = suggestEnvs(branches);
    const envInput = flags.envs || (await ask(rl, '\nBranches dos ambientes, em ordem de promoção (separadas por vírgula)', suggested.join(',')));
    const environments = parseEnvs(envInput);

    const orgDefault = (sf && sf.facts.defaultOrg) || null;
    const referenceOrg = flags.org || (await ask(rl, 'Org de referência para o índice (alias do sf CLI)', orgDefault || '')) || null;

    let designSystem = flags['design-system'];
    if (!designSystem) {
      const answer = await ask(rl, 'Seguimos com o SLDS, o padrão recomendado pela Salesforce? (s/n)', 's');
      designSystem = /^n/i.test(answer) ? await ask(rl, 'Qual design system a equipe usa?', 'próprio') : 'slds';
    }

    const config = {
      ...(flags.language ? { language: flags.language } : {}),
      modules: modules.length ? modules.map((m) => m.mod.name) : DEFAULTS.modules,
      environments,
      reference_org: referenceOrg,
      advisors: { ...DEFAULTS.advisors, design_system: designSystem },
    };
    const file = saveConfig(root, config);
    writeProfile(root, { modules, designSystem, specs });
    const ignored = repo ? ensureGitignore(root) : false;

    logAction(root, 'init', {
      summary: `ambientes: ${environments.map((e) => e.name).join(' → ') || 'nenhum'}; org: ${referenceOrg || 'nenhuma'}`,
    });

    const done = [
      '',
      '✅ Pronto. Criei:',
      `• ${path.relative(root, file)} (configuração, versionada)`,
      `• ${path.relative(root, paths(root).profile)} (perfil do projeto, versionado; revise com o time)`,
    ];
    if (ignored) done.push('• Linhas no .gitignore para os arquivos locais do Reldor');
    if (environments.length) done.push(`• Ambientes: ${environments.map((e) => `${e.name} (${e.branch})`).join(' → ')}; deploy em ${environments[environments.length - 1].name} bloqueado`);
    else done.push('⚠️ Nenhum ambiente configurado. Rode de novo com --envs quando souber as branches.');
    done.push('', '➡️  Próximo passo: rode "reldor status" ou peça à sua IA: "quero usar o Reldor".');
    print(done);
    return 0;
  } finally {
    if (rl) rl.close();
  }
}

module.exports = { initCommand, parseEnvs, suggestEnvs, envName };
