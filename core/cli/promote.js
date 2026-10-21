'use strict';

const { loadConfig, branchName, baseBranch } = require('../config');
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

function renderPromote(r, actions = false, config = {}) {
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
  if (r.conflicts.length) {
    out.push('', `ℹ️  ${r.conflicts.length} arquivo(s) vão dar conflito no git merge. Na branch de merge, o "reldor merge ${r.source}" resolve mantendo o destino e aplicando a sua mudança; os casos difíceis ficam para você revisar.`);
  }
  if (r.missing.length) {
    problems += 1;
    out.push('', `🔴 ${r.missing.length} dependência(s) que não vão existir em ${r.env} depois do merge:`);
    for (const m of r.missing.slice(0, 15)) {
      out.push(`   ${m.kind} ${m.item}, usado em ${m.files.map((f) => f.split('/').pop()).join(', ')}${m.presentIn.length ? ` (existe em: ${m.presentIn.join(', ')})` : ''}`);
    }
    out.push('   ➜ Se o item é da sua feature, falta commitar na sua branch. Se é de outra pessoa, a feature dela precisa chegar antes neste ambiente: combinem a ordem.');
  }
  out.push('');
  // The ensaio never changes anything: the next steps are for the person (or the team's tool) to run.
  out.push(problems ? 'Quando estiver tudo certo, o próximo passo (rode você ou pela ferramenta do time):' : `✅ Pronto para ${r.env}. Próximo passo (rode você ou pela ferramenta do time):`);
  out.push(`   1. git checkout -b ${branchName(config.git?.merge_branch || 'merge/{feature}-{env}', { feature: String(r.source).replace(/\//g, '-'), env: r.env })} ${r.targetRef}`, `   2. reldor merge ${r.source}   (confere e monta o git merge; se o Git parar com conflito, reldor merge --resolve)`, `   3. abra a PR para ${r.branch}.`);
  out.push('', 'ℹ️  Conflito de merge se resolve na branch de merge. Correção de código vai na sua branch de desenvolvimento.');
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
  else print(renderPromote(report, false, config));
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
  const base = gitApi.resolveBranch(root, flags.base || baseBranch(config)) || gitApi.resolveBranch(root, 'master') || gitApi.resolveBranch(root, 'main');
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
