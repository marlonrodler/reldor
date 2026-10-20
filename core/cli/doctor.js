'use strict';

const { buildDoctor } = require('../doctor');
const { title, print, printJson } = require('../report');

const ICON = { ok: '✅', missing: '❌', optional: '➖', unknown: '❔', warn: '⚠️' };

/** Terminal lines: the machine, the folder, the AI plugin, then the next step. */
function render(d) {
  const out = [title(`Reldor ${d.version} · conferindo a instalação`)];
  out.push('No computador:');
  for (const c of d.checks) out.push(`${ICON[c.state] || '•'} ${c.label}: ${c.detail}${c.state !== 'ok' && c.fix ? `\n     Como resolver: ${c.fix}` : ''}`);
  out.push(`${d.install.synced ? '⚠️' : '✅'} Reldor instalado em ${d.install.folder} (${d.install.mode === 'npm' ? 'pelo npm' : 'pasta clonada'})`);
  if (d.install.synced) out.push('     Essa pasta é sincronizada (OneDrive ou parecido): pode ficar lenta. Prefira instalar pelo npm: npm install -g github:marlonrodler/reldor');
  out.push(`     Para atualizar: ${d.install.update}`);
  out.push('', 'Na IA:');
  out.push(`${ICON[d.plugin.state]} ${d.plugin.label}: ${d.plugin.detail}`);
  out.push('', 'Nesta pasta:');
  out.push(`• Terminal em: ${d.folder.cwd}`);
  if (d.folder.reldorFolder) out.push('⚠️ Esta é a pasta do próprio Reldor, não a de um projeto.');
  else if (d.folder.project.length) out.push(`✅ Projeto ${d.folder.project.join(', ')} em ${d.folder.root}`);
  else out.push(`❌ Não achei um projeto aqui${d.folder.markers.length ? ` (${d.folder.markers.join('; ')})` : ''}.`);
  if (!d.folder.reldorFolder && d.folder.project.length) {
    out.push(d.folder.gitRepo ? '✅ Repositório Git' : '⚠️ Esta pasta não é um repositório Git: o Reldor precisa do Git para comparar as suas mudanças.');
    out.push(d.folder.configured ? '✅ Reldor configurado neste projeto (.reldor/)' : '➖ Reldor ainda não configurado neste projeto');
    if (d.folder.toolSuggestions) out.push(`💡 ${d.folder.toolSuggestions} sinal(is) de ferramentas do time que fazem o mesmo que o Reldor (reldor tools)`);
  }
  out.push('', `➡️  Próximo passo: ${d.next}`);
  return out;
}

/** reldor doctor [--json] */
async function doctorCommand(root, flags) {
  const d = buildDoctor(root, flags.cwd || process.cwd());
  if (flags.json) printJson(d);
  else print(render(d));
  return d.ready ? 0 : 1;
}

module.exports = { doctorCommand, render };
