'use strict';

const { loadConfig } = require('../config');
const gitApi = require('../git');
const { logAction } = require('../log');
const { print, printJson } = require('../report');
const { planRollback } = require('../../modules/sf/rollback');

function renderRollback(r, config, root) {
  const envs = config.environments || [];
  const first = envs[0];
  const prod = envs[envs.length - 1];
  const out = [`\n🛡️  Plano de rollback: ${r.target} (commit ${r.merge})`, ''];
  out.push(`• Está em: ${r.environments.length ? r.environments.join(', ') : 'nenhum ambiente configurado'}`);
  out.push(`• ${r.commits.length} commit(s) a desfazer:`);
  for (const c of r.commits.slice(0, 10)) out.push(`   ${c.short} ${c.subject} (${c.author})`);

  if (r.restore.length) {
    out.push('', `↩️  ${r.restore.length} item(ns) voltam ao que eram (o revert cuida disso):`);
    for (const x of r.restore.slice(0, 20)) out.push(`   ${x.type} ${x.member}: ${x.action}`);
  }
  if (r.destructive.length) {
    out.push('', `🗑️  ${r.destructive.length} item(ns) foram criados pela PR e precisam ser apagados da org (destructiveChanges.xml):`);
    for (const d of r.destructive) out.push(`   ${d.type} ${d.member}${d.note ? `\n      ⚠️ ${d.note}` : ''}`);
  }
  if (r.stillUsed.length) {
    out.push('', '🔴 Itens que seriam apagados mas ainda são usados depois da PR (o deploy vai falhar):');
    for (const s of r.stillUsed) out.push(`   ${s.item}: ${s.files.join(', ')}${s.more ? ` e mais ${s.more}` : ''}`);
  }
  if (r.later.length) {
    out.push('', '🟡 Arquivos que mudaram de novo depois da PR (o revert pode dar conflito ou desfazer trabalho de outra pessoa):');
    for (const l of r.later.slice(0, 15)) out.push(`   ${l.file}: ${l.commits.map((c) => `${c.hash} ${c.subject} (${c.author})`).join('; ')}`);
  }
  if (r.unknown.length) out.push('', `ℹ️  Arquivos que o Reldor não sabe mapear para metadado (confira à mão): ${r.unknown.join(', ')}`);

  const hashes = r.commits.map((c) => c.short).join(' ');
  out.push('', require('../config').gitActionsOn(config) ? '📋 Passo a passo, no fluxo do time:' : '📋 O que precisa ser feito (pelo seu fluxo ou à mão; o Reldor não executa):');
  out.push(`   1. git checkout -b rollback/${r.id} ${prod ? gitApi.resolveBranch(root, prod.branch) || prod.branch : 'master'}`);
  out.push(`   2. git revert --no-edit ${hashes || r.merge}`);
  out.push('      (reverter os commits da feature, e não o merge, faz o rollback passar pela esteira em ordem)');
  if (r.destructive.length) {
    out.push(`   3. Manifestos prontos em ${r.manifests.destructive.replace(/\/destructiveChanges\.xml$/, '/')}`);
    out.push('      Se a esteira do time lê destructiveChanges de uma pasta do repositório, copie para lá.');
    out.push(`      Validação sem salvar: sf project deploy start --manifest ${r.manifests.package} --post-destructive-changes ${r.manifests.destructive} --dry-run --target-org <org>`);
  }
  out.push(`   ${r.destructive.length ? 4 : 3}. Promova a branch de rollback como uma feature: reldor promote ${first ? first.name : '<ambiente>'}, e assim por diante.`);
  out.push('', 'ℹ️  Nada foi alterado. Dados de registros (Data Loader, scripts) não voltam com o rollback.');
  return out;
}

function rollbackCommand(root, flags, args) {
  if (!gitApi.isRepo(root)) {
    print('⚠️ Esta pasta não é um repositório Git.');
    return 1;
  }
  if (!args[0]) {
    print('Use: reldor rollback <número da PR | commit | branch>');
    return 1;
  }
  const { config } = loadConfig(root);
  if (flags.fetch) gitApi.fetch(root);
  const { readProject } = require('../../modules/sf');
  const project = readProject(root) || {};
  const plan = planRollback(root, config, { target: args[0], apiVersion: project.apiVersion || '61.0' });
  logAction(root, 'rollback-plan', { summary: `${plan.target}: ${plan.commits.length} commit(s), ${plan.destructive.length} para apagar` });
  if (flags.json) printJson(plan);
  else print(renderRollback(plan, config, root));
  return 0;
}

module.exports = { rollbackCommand };
