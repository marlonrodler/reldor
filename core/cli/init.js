'use strict';

const fs = require('node:fs');
const path = require('node:path');

const gitApi = require('../git');
const { DEFAULTS, loadConfig, saveConfig } = require('../config');
const { writeProfile } = require('../profile');
const { detectModules } = require('../modules');
const { findSpecs } = require('../spec');
const { logAction } = require('../log');
const { title, print, printJson } = require('../report');

const GITIGNORE_LINES = ['.reldor/cache/', '.reldor/work/', '.reldor/log/', '.reldor/local.yaml'];

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
    if (i === parts.length - 1) {
      env.production = true;
      env.deploy = 'blocked';
    }
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

/**
 * reldor init: detects the project and writes the config and profile.md. It asks nothing: environments and the org are
 * only needed by some commands, and those ask when the time comes (or take --envs / --org here).
 */
async function initCommand(root, flags) {
  const out = [title('Reldor · configuração')];
  const existing = loadConfig(root);
  if (existing.exists && !flags.force) {
    if (flags.json) {
      printJson({ configured: true, created: false, config: path.relative(root, existing.file), next: 'reldor profile (atualiza o profile.md) ou reldor init --force (refaz tudo)' });
      return 0;
    }
    print([...out, '✅ O Reldor já está configurado neste projeto.', `• Arquivo: ${path.relative(root, existing.file)}`, '• Para atualizar o profile.md com o que está no projeto hoje: reldor profile', '• Para refazer tudo: reldor init --force']);
    return 0;
  }

  const repo = gitApi.isRepo(root);
  if (!repo) out.push('⚠️ Esta pasta não é um repositório Git. O status de ambientes ficará desligado.');

  const modules = detectModules(root).map((mod) => ({ mod, facts: mod.detect(root, { skipCli: Boolean(flags['no-cli']) }) }));
  const sf = modules.find((m) => m.mod.name === 'sf');
  const specs = findSpecs(root, DEFAULTS);

  const environments = flags.envs ? parseEnvs(flags.envs) : [];
  const referenceOrg = (typeof flags.org === 'string' && flags.org) || (sf && sf.facts.defaultOrg) || null;
  const designSystem = typeof flags['design-system'] === 'string' ? flags['design-system'] : 'slds';

  const config = {
    ...(flags.language ? { language: flags.language } : {}),
    modules: modules.length ? modules.map((m) => m.mod.name) : DEFAULTS.modules,
    ...(environments.length ? { environments } : {}),
    ...(referenceOrg ? { reference_org: referenceOrg } : {}),
    advisors: { design_system: designSystem },
  };
  const file = saveConfig(root, config);
  const { file: profile } = writeProfile(root, { modules, designSystem, specs });
  const ignored = repo ? ensureGitignore(root) : false;
  logAction(root, 'init', { summary: `ambientes: ${environments.map((e) => e.name).join(' → ') || 'nenhum'}; org: ${referenceOrg || 'nenhuma'}` });

  out.push('Detectei:');
  out.push(sf ? '• Projeto Salesforce (sfdx-project.json)' : '• Nenhum projeto Salesforce (sfdx-project.json ausente)');
  if (sf) out.push(...sf.mod.statusLines(sf.facts));
  out.push(`• Specs: ${specs.length ? specs.length + ' encontrada(s)' : 'nenhuma'}`);
  out.push(
    '',
    '✅ Pronto. Criei:',
    `• ${path.relative(root, file)}: a configuração (só o que foi detectado; vai no commit para o time usar a mesma)`,
    `• ${path.relative(root, profile)}: o perfil do projeto, lido dos arquivos (classes, triggers, fflib, nomes); a parte "Padrões da equipe" é do time`,
  );
  if (ignored) out.push('• Linhas no .gitignore para os arquivos locais do Reldor (cache, log, work)');
  out.push(referenceOrg ? `• Org de referência: ${referenceOrg} (a org padrão do sf CLI)` : '• Org: nenhuma ainda. Quando um comando precisar, ele pergunta (ou: reldor env --org <alias>).');
  if (environments.length) out.push(`• Ambientes: ${environments.map((e) => `${e.name} (${e.branch})`).join(' → ')}`);
  else out.push('• Ambientes: nenhum ainda. Só fazem falta para ver onde a sua branch já está e para o ensaio de promoção (reldor env set).');
  out.push('• O Reldor não executa nada no Git nem na org: ele confere e monta os comandos; quem roda é você.');
  const found = require('../tools').toolsReport(root, config).suggestions;
  if (flags.json) {
    printJson({ configured: true, created: true, config: path.relative(root, file), profile: path.relative(root, profile), detected: { salesforce: Boolean(sf), specs: specs.length }, reference_org: referenceOrg, environments, gitignore: ignored, tools: found, next: found.length ? 'reldor tools' : 'reldor status' });
    return 0;
  }
  if (found.length) {
    out.push('', `💡 Encontrei sinais de ferramentas do time que já fazem parte do que o Reldor faz (${found.length}):`);
    for (const f of found.slice(0, 6)) out.push(`   • ${f.capability}: ${f.owner}`);
    out.push('   Para o Reldor não repetir esse trabalho, confira e decida com: reldor tools');
  }
  out.push('', '➡️  Próximo passo: rode "reldor status" ou peça à sua IA: "quero usar o Reldor".');
  print(out);
  return 0;
}

module.exports = { initCommand, parseEnvs, suggestEnvs, envName, ensureGitignore };
