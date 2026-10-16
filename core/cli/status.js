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

  out.push('', 'Spec:');
  if (status.spec.current) out.push(`• ${status.spec.current.path} (${status.spec.current.files.join(', ')})`);
  else if (status.spec.available.length) out.push(`• Nenhuma spec ligada a esta branch. Recentes: ${status.spec.available.map((s) => s.name).join(', ')}`);
  else out.push('• Nenhuma spec encontrada.');

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
