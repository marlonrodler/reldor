'use strict';

const { loadConfig } = require('../config');
const gitApi = require('../git');
const { logAction } = require('../log');
const { print, printJson } = require('../report');
const { rehearse } = require('../../modules/sf/promote');

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

function renderPromote(r) {
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
  if (!problems) out.push(`✅ Pronto para ${r.env}. Próximo passo, no fluxo do time:`);
  else out.push('Quando estiver tudo certo, o próximo passo é:');
  out.push(`   git checkout -b merge/${String(r.source).replace(/[^\w.-]+/g, '-')}-${r.env} ${r.targetRef}`, `   git merge ${r.source}`, `   e abra a PR para ${r.branch}.`);
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
  else print(renderPromote(report));
  return 0;
}

module.exports = { promoteCommand, renderPromote };
