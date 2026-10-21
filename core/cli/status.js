'use strict';

const { buildStatus } = require('../status');
const { title, print, printJson } = require('../report');

const STATE = {
  present: '✅',
  current: '📍',
  missing: '⬜',
  unknown: '❔',
};

function render({ status, modules }) {
  const out = [title('Reldor · situação atual')];

  if (!status.git.repo) {
    out.push('⚠️ Esta pasta não é um repositório Git.');
  } else {
    out.push(`• Branch: ${status.git.branch}`);
    const p = status.git.pending;
    const total = p.modified.length + p.added.length + p.deleted.length + p.untracked.length;
    out.push(
      total === 0
        ? '• Nada pendente para commit'
        : `• Pendente: ${p.modified.length} alterado(s), ${p.added.length} novo(s), ${p.deleted.length} apagado(s), ${p.untracked.length} fora do Git`,
    );
  }

  for (const { mod, facts } of modules) {
    out.push('', `${mod.label}:`);
    out.push(...mod.statusLines(facts));
  }

  out.push('', 'Ambientes:');
  const env = status.environments;
  if (!env.configured) {
    out.push('• Cadeia de ambientes não configurada (rode reldor init).');
  } else {
    for (const item of env.items) {
      const extra = item.state === 'missing' ? ` (faltam ${item.missing} commit(s))` : item.reason ? ` (${item.reason})` : '';
      out.push(`${STATE[item.state]} ${item.name} · ${item.branch}${extra}`);
    }
    if (env.featureCommits === 0) out.push('• Esta branch ainda não tem commits próprios.');
  }

  const t = status.task;
  if (t && t.id) {
    const phase = { refinar: 'refinar', desenvolver: 'desenvolver', promover: 'revisar e promover' }[t.phase] || t.phase;
    out.push('', 'Tarefa:');
    if (t.switched) out.push(`🔄 Mudou de tarefa: ${t.switched.from} → ${t.switched.to}. O que era da ${t.switched.from} fica guardado em .reldor/work/tasks/.`);
    out.push(`• ${t.id} (${t.source === 'chat' ? 'dita no chat' : 'pela branch'}) · fase: ${phase}${t.resumed ? ' · retomando o que já foi feito' : ''}`);
    if (t.specs.length > 1) out.push(`• Specs encontradas: ${t.specs.map((x) => `${x.path} (${x.tool})`).join(', ')}: qual vale? (reldor task)`);
  }
  out.push('', 'Spec:');
  if (status.spec.current) out.push(`• ${status.spec.current.path} (${status.spec.current.files.join(', ')})`);
  else if (status.spec.available.length) out.push(`• Nenhuma spec ligada a esta branch. Recentes: ${status.spec.available.map((s) => s.name).join(', ')}`);
  else out.push('• Nenhuma spec encontrada.');

  if (status.tools && (status.tools.others.length || status.tools.suggestions.length)) {
    out.push('', 'Ferramentas do time:');
    for (const t of status.tools.others) out.push(`${t.mode === 'verify' ? '🔎' : '➖'} ${t.id}: ${t.owner || 'outra ferramenta'} (${t.mode === 'verify' ? 'o Reldor só confere' : 'o Reldor fica de fora'})`);
    if (status.tools.suggestions.length) out.push(`💡 ${status.tools.suggestions.length} sinal(is) de ferramentas do time ainda não configurado(s): reldor tools`);
  }

  if (!status.config.exists) out.push('', '⚠️ O Reldor ainda não foi configurado neste projeto.');

  if (status.alerts && status.alerts.length) {
    out.push('', '🛡️  Avisos (se subir agora):');
    for (const a of status.alerts) out.push(`${a.level === 'alta' ? '🔴' : '🟡'} ${a.text}`);
  }

  out.push('', `➡️  Próximo passo: ${status.next.text}`);
  return out;
}

function statusCommand(root, flags) {
  const result = buildStatus(root, { fetch: Boolean(flags.fetch), skipCli: Boolean(flags['no-cli']), alerts: !flags.quick });
  if (flags.json) printJson(result.status);
  else print(render(result));
  return 0;
}

module.exports = { statusCommand, render };
