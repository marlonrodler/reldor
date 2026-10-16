'use strict';

const { loadConfig } = require('../config');
const gitApi = require('../git');
const { logAction } = require('../log');
const { print, printJson } = require('../report');
const { rehearse } = require('../../modules/sf/promote');
const { findCollisions } = require('../../modules/sf/promote/collisions');

/** Next environment the branch has not fully reached yet. */
function nextEnvironment(root, environments) {
  for (const e of environments) {
    const ref = gitApi.resolveBranch(root, e.branch);
    if (!ref) continue;
    const missing = gitApi.missingCommits(root, { target: ref });
    if (missing && missing.length) return e.name;
  }
  return null;
}

function renderPromote(r, actions = false) {
  const out = [`\n🛡️  Ensaio de promoção: ${r.source} → ${r.env} (${r.branch})`, ''];
  if (!r.commits.length) {
    out.push(`✅ Nada para promover: tudo da sua branch já está em ${r.env}.`);
    return out;
  }
  out.push(`• ${r.commits.length} commit(s) vão junto:`);
  for (const c of r.commits.slice(0, 10)) out.push(`   ${c.hash} ${c.subject} (${c.author})`);
  if (r.commits.length > 10) out.push(`   … e mais ${r.commits.length - 10}`);

  let problems = 0;
  if (r.notInPrevious.length) {
    problems += 1;
    out.push('', `🔴 ${r.notInPrevious.length} commit(s) ainda não passaram por ${r.previous}. A esteira vai bloquear:`);
    for (const c of r.notInPrevious.slice(0, 10)) out.push(`   ${c.hash} ${c.subject}`);
    out.push(`   ➜ Promova primeiro para ${r.previous} (reldor promote ${r.previous}).`);
  }
  if (r.foreign) {
    problems += 1;
    out.push('', `🟡 ${r.foreign.commits.length} commit(s) de outras pessoas iriam junto para ${r.env}${r.foreign.from.length ? ` (vieram de ${r.foreign.from.join(', ')})` : ''}:`);
    for (const c of r.foreign.commits.slice(0, 8)) out.push(`   ${c.hash} ${c.subject} (${c.author})`);
    out.push('   ➜ Se veio de um merge ou pull de outro ambiente na sua branch, recrie a branch a partir da master só com os seus commits (git cherry-pick). Se é alguém do seu par, tudo certo.');
  }
  const xmlOk = r.conflicts.filter((c) => c.kind === 'metadado' && c.resolvable);
  const xmlBad = r.conflicts.filter((c) => c.kind === 'metadado' && !c.resolvable);
  const lineBad = r.conflicts.filter((c) => c.kind === 'linha');
  if (xmlOk.length) {
    out.push('', `🟢 ${xmlOk.length} conflito(s) do Git em metadados que o Reldor resolve item a item:`);
    for (const c of xmlOk) out.push(`   ${c.file}`);
    if (!r.driver) out.push('   ➜ Ligue o merge inteligente uma vez (reldor merge install) e o `git merge` já resolve sozinho.');
  }
  if (xmlBad.length || lineBad.length) {
    problems += 1;
    out.push('', `🟡 ${xmlBad.length + lineBad.length} conflito(s) que precisam de uma pessoa:`);
    for (const c of xmlBad) out.push(`   ${c.file}: ${c.items.map((i) => `${i.section} ${i.key}`).join(', ')} (os dois lados mudaram o mesmo item)`);
    for (const c of lineBad) out.push(`   ${c.file}`);
    out.push(r.rerere ? '   ➜ O rerere está ligado: resolva uma vez e o Git repete a resolução nos próximos ambientes.' : '   ➜ Ligue o rerere (reldor merge install) para não resolver o mesmo conflito em cada ambiente.');
  }
  if (r.missing.length) {
    problems += 1;
    out.push('', `🔴 ${r.missing.length} dependência(s) que não vão existir em ${r.env} depois do merge:`);
    for (const m of r.missing.slice(0, 15)) {
      out.push(`   ${m.kind} ${m.item}, usado em ${m.files.map((f) => f.split('/').pop()).join(', ')}${m.presentIn.length ? ` (existe em: ${m.presentIn.join(', ')})` : ''}`);
    }
    out.push('   ➜ Inclua o metadado na sua branch, ou espere a feature que criou o item chegar neste ambiente.');
  }
  out.push('');
  if (!actions) {
    out.push(problems ? `Quando estiver tudo certo, siga o seu fluxo (ex.: o plugin de fluxo do time) para levar a branch a ${r.env}.` : `✅ Pronto para ${r.env}. Pode seguir o seu fluxo (ex.: o plugin de fluxo do time): branch de merge, merge e PR para ${r.branch}.`);
  } else {
    if (!problems) out.push(`✅ Pronto para ${r.env}. Próximo passo, no fluxo do time:`);
    else out.push('Quando estiver tudo certo, o próximo passo é:');
    out.push(`   git checkout -b merge/${String(r.source).replace(/[^\w.-]+/g, '-')}-${r.env} ${r.targetRef}`, `   git merge ${r.source}`, `   e abra a PR para ${r.branch}.`);
  }
  out.push('', 'ℹ️  Ajustes vão sempre na sua branch de desenvolvimento, nunca na branch de merge.');
  return out;
}

function promoteCommand(root, flags, args) {
  if (!gitApi.isRepo(root)) {
    print('⚠️ Esta pasta não é um repositório Git.');
    return 1;
  }
  const { config } = loadConfig(root);
  if (flags.fetch) gitApi.fetch(root);
  const env = args[0] || nextEnvironment(root, config.environments || []);
  if (!env) {
    print('✅ A sua branch já está em todos os ambientes configurados.');
    return 0;
  }
  const report = rehearse(root, config, { env, source: flags.branch || 'HEAD' });
  logAction(root, 'promote', { summary: `${report.source} → ${report.env}: ${report.commits.length} commit(s), ${report.conflicts.length} conflito(s), ${report.missing.length} dependência(s)` });
  if (flags.json) printJson(report);
  else print(renderPromote(report, require('../config').gitActionsOn(config)));
  return 0;
}


const RISK_ICON = { alto: '🔴', 'médio': '🟡', baixo: '⚪' };

function renderCollisions(r) {
  const out = ['\n🛡️  Radar de colisão', '', `• ${r.files} arquivo(s) na sua branch · ${r.branches} trabalho(s) em andamento conferido(s)`];
  if (r.pullRequests === null) out.push('ℹ️  Não consegui ler as PRs abertas do GitHub (gh não instalado ou sem login): conferi só as branches que já estão em algum ambiente.');
  if (r.ignored) out.push(`ℹ️  ${r.ignored} branch(es) sem PR e fora dos ambientes foram ignoradas (podem estar paradas). Para ver todas: --all`);
  if (!r.collisions.length) {
    out.push('', '✅ Ninguém com trabalho em andamento mexe nos seus arquivos.');
    return out;
  }
  for (const c of r.collisions) {
    const where = c.pr ? ` · PR #${c.pr.number} para ${c.pr.base}` : c.reached.length ? ` · já está em: ${c.reached.join(', ')}` : ' · branch sem PR';
    out.push('', `${c.branch} (${c.author}${c.date ? `, ${c.date}` : ''})${where}`);
    for (const f of c.files) out.push(`   ${RISK_ICON[f.risk]} ${f.file}: ${f.why}`);
  }
  out.push('', '➜ Risco alto: combine com a outra pessoa antes; quem promover depois vai resolver o conflito.');
  out.push('➜ Se a outra branch já está num ambiente, rode o ensaio (reldor promote) para ver o conflito de verdade.');
  return out;
}

function collisionsCommand(root, flags) {
  if (!gitApi.isRepo(root)) {
    print('⚠️ Esta pasta não é um repositório Git.');
    return 1;
  }
  const { config } = loadConfig(root);
  if (flags.fetch) gitApi.fetch(root);
  const envs = config.environments || [];
  const base = gitApi.resolveBranch(root, flags.base || (envs.length ? envs[envs.length - 1].branch : null)) || gitApi.resolveBranch(root, 'master') || gitApi.resolveBranch(root, 'main');
  if (!base) {
    print('⚠️ Não achei a branch de produção (master/main). Use --base <branch>.');
    return 1;
  }
  const report = findCollisions(root, { base, environments: envs, days: Number(flags.days) || 30, all: Boolean(flags.all) });
  logAction(root, 'collisions', { summary: `${report.collisions.length} branch(es) com arquivos em comum` });
  if (flags.json) printJson(report);
  else print(renderCollisions(report));
  return 0;
}

module.exports = { promoteCommand, renderPromote, collisionsCommand };
