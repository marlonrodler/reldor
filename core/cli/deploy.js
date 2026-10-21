'use strict';

/**
 * reldor deploy [ambiente] [--org <alias>] [--files a,b] [--base <branch>]
 * Builds the commands to validate and deploy what your branch changed. It never runs them: deploying is the person's
 * (or the pipeline's) call. Validation first (--dry-run, with the tests the radar found), then the deploy itself, or
 * the quick deploy of the validated job. In production, only the validation: the deploy goes through the pipeline.
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('../config');
const { logAction } = require('../log');
const { print, printJson, handover, cmdLine } = require('../report');

/** Files to deploy: the changed ones inside the package folders (an LWC goes as its folder). */
function deployPaths(root, changes) {
  const { readProject } = require('../../modules/sf');
  const dirs = (readProject(root)?.packageDirectories || ['force-app']).map((d) => d.replace(/\\/g, '/').replace(/\/$/, ''));
  const out = new Set();
  const removed = [];
  for (const c of changes) {
    if (!dirs.some((d) => c.file === d || c.file.startsWith(`${d}/`))) continue;
    if (c.status === 'deleted' || !fs.existsSync(path.join(root, c.file))) {
      removed.push(c.file);
      continue;
    }
    const type = c.meta ? c.meta.type : c.type;
    out.add(/^lwc|^aura/i.test(String(type)) || /\/(lwc|aura)\/[^/]+\//.test(c.file) ? path.posix.dirname(c.file) : c.file);
  }
  return { paths: [...out].sort(), removed };
}

async function deployCommand(root, flags, args) {
  const { readProject } = require('../../modules/sf');
  if (!readProject(root)) {
    process.stderr.write('⚠️ sfdx-project.json não encontrado: rode o comando dentro de um projeto Salesforce.\n');
    return 1;
  }
  const { config } = loadConfig(root);
  const { changedFiles } = require('../../modules/sf/test-radar/changes');
  const { buildIndex } = require('../../modules/sf/indexer');
  const { buildRadar } = require('../../modules/sf/test-radar');
  const { resolveOrg } = require('../../modules/sf/org/guard');
  const sfModule = require('../../modules/sf');

  // Which org: --org, the named environment's org, the reference org or the sf default. Asked only when missing.
  const env = args[0] ? (config.environments || []).find((e) => e.name === args[0]) : null;
  if (args[0] && !env) {
    print(`⚠️ Ambiente "${args[0]}" não está na cadeia (reldor env). Ou informe a org direto: reldor deploy --org <alias>`);
    return 1;
  }
  const orgFlag = flags.org || (env && env.org) || null;
  const target = resolveOrg(config, { org: orgFlag }, orgFlag || config.reference_org ? null : sfModule.detect(root).defaultOrg);
  const org = target.error ? '<alias-da-org>' : target.org;
  const production = Boolean(!target.error && target.production) || Boolean(env && (env.production === true || env.deploy === 'blocked'));

  const changes = changedFiles(root, config, { base: flags.base, files: flags.files });
  const { paths: files, removed } = deployPaths(root, changes);
  if (!files.length) {
    print(['\n🛡️  Deploy', '', 'Nenhum arquivo alterado para subir (compare com --base <branch> ou informe --files).']);
    return 0;
  }
  const { model } = buildIndex(root, {});
  const tests = buildRadar(model, changes).tests.map((t) => t.name);
  const testArgs = tests.length ? ['--test-level', 'RunSpecifiedTests', ...tests.flatMap((t) => ['--tests', t])] : production ? ['--test-level', 'RunLocalTests'] : ['--test-level', 'NoTestRun'];
  const base = ['sf', 'project', 'deploy', 'start', '--target-org', org, ...files.flatMap((f) => ['--source-dir', f]), ...testArgs, '--wait', '60'];
  const steps = [{ cmd: cmdLine([...base.slice(0, 4), '--dry-run', ...base.slice(4)]), why: 'validação: confere e roda os testes sem salvar nada' }];
  if (production) {
    steps.push({ cmd: 'o deploy em produção segue pela esteira do time', why: 'o Reldor só monta a validação' });
  } else {
    steps.push({ cmd: cmdLine(['sf', 'project', 'deploy', 'quick', '--job-id', '<Job ID da validação>', '--target-org', org]), why: 'sobe o que a validação aprovou, sem rodar de novo' });
    steps.push({ cmd: cmdLine(base), why: 'ou, sem validar antes, o deploy direto' });
  }
  logAction(root, 'deploy-plan', { summary: `${files.length} arquivo(s) para ${org}${production ? ' (produção: só validação)' : ''}` });
  const data = { org: target.error ? null : org, environment: env ? env.name : target.environment || null, production, files, removed, tests, commands: steps.filter((s) => s.cmd.startsWith('sf ')).map((s) => s.cmd) };
  if (flags.json) {
    printJson(data);
    return 0;
  }
  const out = ['\n🛡️  Deploy (o Reldor só monta os comandos; quem roda é você)', ''];
  out.push(`• Org: ${target.error ? 'não informada (troque <alias-da-org> ou rode com --org <alias>)' : `${org}${data.environment ? ` (${data.environment})` : ''}`}${production ? ' · PRODUÇÃO' : ''}`);
  out.push(`• ${files.length} arquivo(s) ou pasta(s): ${files.slice(0, 8).map((f) => f.split('/').pop()).join(', ')}${files.length > 8 ? ', ...' : ''}`);
  out.push(tests.length ? `• Testes que a mudança pode quebrar (do radar): ${tests.join(', ')}` : production ? '• O radar não achou testes afetados: em produção, RunLocalTests.' : '• O radar não achou testes afetados: sem testes (NoTestRun).');
  if (removed.length) out.push(`⚠️ ${removed.length} arquivo(s) apagado(s) não sobem por aqui (${removed.slice(0, 5).map((f) => f.split('/').pop()).join(', ')}): apagar da org pede um destructiveChanges.xml (o reldor rollback mostra o formato).`);
  out.push('ℹ️  Antes, vale rodar o reldor review: segurança, queries e testes num resumo só.');
  out.push(...handover(steps, { intro: '▶️  Rode você, na pasta do projeto:' }));
  print(out);
  return 0;
}

module.exports = { deployCommand, deployPaths };
