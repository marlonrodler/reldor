'use strict';

const { loadConfig, readRawConfig, saveConfig, productionEnv, baseBranch, branchName } = require('../config');
const gitApi = require('../git');
const { logAction } = require('../log');
const { print, printJson } = require('../report');
const { parseEnvs } = require('./init');

function show(root) {
  const { config } = loadConfig(root);
  const envs = config.environments || [];
  const prod = productionEnv(config);
  const out = ['\n🛡️  Cadeia de ambientes (na ordem de promoção)', ''];
  if (!envs.length) {
    out.push('Nenhum ambiente configurado.', '', 'Para configurar: reldor env set "pre-uat:develop/x, uat:rc/uat, producao:master"');
    return { out, data: { environments: [] } };
  }
  envs.forEach((e, i) => {
    const ok = gitApi.isRepo(root) ? Boolean(gitApi.resolveBranch(root, e.branch)) : true;
    const tags = [e === prod ? 'produção' : null, e.deploy === 'blocked' ? 'deploy bloqueado' : null, e.org ? `org: ${e.org}` : null].filter(Boolean);
    out.push(`${i + 1}. ${e.name} → ${e.branch}${tags.length ? `  (${tags.join(', ')})` : ''}${ok ? '' : '  ⚠️ branch não encontrada aqui'}`);
  });
  const mergeTpl = config.git?.merge_branch || 'merge/{feature}-{env}';
  out.push('', `• As branches de desenvolvimento nascem de: ${baseBranch(config)}`);
  out.push(`• Nome sugerido da branch de merge: ${mergeTpl} (ex.: ${branchName(mergeTpl, { feature: 'feature-123', env: envs[0].name })})`);
  out.push(`• Nome sugerido da branch de rollback: ${config.git?.rollback_branch || 'rollback/{id}'}`);
  out.push('', 'Para mudar: reldor env set "<nome>:<branch>, ..."  ·  --base <branch>  ·  --merge-branch "<padrão>"  ·  --production <nome>');
  return { out, data: { environments: envs, production: prod ? prod.name : null, base_branch: baseBranch(config), merge_branch: mergeTpl, rollback_branch: config.git?.rollback_branch || 'rollback/{id}' } };
}

/**
 * reldor env                          shows the chain
 * reldor env set "a:branch1, b:branch2, c:branch3"   replaces the chain (keeps orgs of environments with the same name)
 * reldor env --base <branch> --merge-branch "<pattern>" --rollback-branch "<pattern>" --production <name>
 */
function envCommand(root, flags, args) {
  const raw = readRawConfig(root);
  let changed = false;
  if (args[0] === 'set') {
    const value = args.slice(1).join(' ');
    const next = parseEnvs(value);
    if (!next.length) {
      print('⚠️ Informe os ambientes: reldor env set "pre-uat:develop/x, uat:rc/uat, producao:master"');
      return 1;
    }
    const old = new Map((raw.environments || []).map((e) => [e.name, e]));
    raw.environments = next.map((e) => {
      const before = old.get(e.name) || {};
      const merged = { ...before, ...e };
      if (e.production !== true) delete merged.production;
      if (e.deploy !== 'blocked' && before.deploy !== 'blocked') delete merged.deploy;
      return merged;
    });
    changed = true;
  }
  if (typeof flags.production === 'string') {
    const envs = raw.environments || [];
    if (!envs.some((e) => e.name === flags.production)) {
      print(`⚠️ Ambiente "${flags.production}" não está na cadeia.`);
      return 1;
    }
    for (const e of envs) {
      if (e.name === flags.production) {
        e.production = true;
        e.deploy = 'blocked';
      } else delete e.production;
    }
    changed = true;
  }
  for (const [flag, key] of [['base', 'base_branch'], ['merge-branch', 'merge_branch'], ['rollback-branch', 'rollback_branch']]) {
    if (typeof flags[flag] === 'string') {
      raw.git = { ...(raw.git || {}), [key]: flags[flag] };
      changed = true;
    }
  }
  if (changed) {
    saveConfig(root, raw);
    logAction(root, 'env', { summary: (raw.environments || []).map((e) => `${e.name}:${e.branch}`).join(' → ') });
  }
  const { out, data } = show(root);
  if (flags.json) printJson(data);
  else print(changed ? ['✅ Configuração atualizada (.reldor/reldor.config.yaml). Lembre de commitar o arquivo para o time usar a mesma cadeia.', ...out] : out);
  return 0;
}

module.exports = { envCommand };
