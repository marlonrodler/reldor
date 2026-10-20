'use strict';

const { loadConfig } = require('../config');
const { logAction } = require('../log');
const { print, printJson } = require('../report');
const tools = require('../tools');

const ICON = { run: '🛡️', verify: '🔎', skip: '➖' };

/** Terminal lines: every capability with who takes care of it, then the signs found in the project. */
function render(report, config) {
  const out = ['\n🛡️  Ferramentas do time · quem cuida de cada coisa', ''];
  out.push(`🛡️ o Reldor faz   🔎 o Reldor só confere   ➖ o Reldor fica de fora`, '');
  for (const c of report.capabilities) {
    out.push(`${ICON[c.mode]} ${c.id.padEnd(15)} ${c.label}${c.owner ? ` · ${c.owner}` : ''}`);
  }
  out.push(`ℹ️  Branch, commit, merge e PR: ${String(config.git?.actions || 'off') === 'on' ? 'o Reldor pode fazer, com confirmação' : 'ficam com a ferramenta do time (git.actions: off)'}`);
  if (report.suggestions.length) {
    out.push('', `💡 Encontrei sinais de ferramentas do time que ainda não estão na configuração (${report.suggestions.length}):`);
    for (const s of report.suggestions) {
      out.push(`   • ${s.capability} → ${s.suggested === 'verify' ? 'conferir' : 'ficar de fora'}: ${s.owner}`);
      for (const e of s.evidence.slice(0, 2)) out.push(`       ${e}`);
      out.push(`     ➜ reldor tools set ${s.capability} ${s.suggested} --owner "${s.owner.replace(/"/g, "'")}"`);
    }
    out.push('', 'Confira cada sinal antes: só você sabe se aquela ferramenta faz mesmo o mesmo trabalho.');
  } else if (report.found.length) out.push('', '✅ Os sinais de outras ferramentas que encontrei já estão na configuração.');
  else out.push('', 'Não encontrei sinais de outras ferramentas (ganchos, esteira, instruções da IA).');
  return out;
}

/**
 * reldor tools                                   the list and the suggestions
 * reldor tools set <capacidade> <run|verify|skip> [--owner "nome"]
 */
function toolsCommand(root, flags, args) {
  const [action, id, mode] = args;
  if (action === 'set') {
    if (!id || !mode) {
      process.stderr.write('⚠️ Use: reldor tools set <capacidade> <run|verify|skip> [--owner "nome da ferramenta"]\n');
      return 1;
    }
    const r = tools.setTool(root, id, mode, typeof flags.owner === 'string' ? flags.owner : null);
    if (r.error) {
      process.stderr.write(`⚠️ ${r.error}\n`);
      return 1;
    }
    logAction(root, 'tools-set', { summary: `${id}: ${mode}${flags.owner ? ` (${flags.owner})` : ''}` });
    print([`✅ ${id}: ${tools.MODE_LABEL[mode]}${typeof flags.owner === 'string' ? ` · ${flags.owner}` : ''}.`, 'Gravado em .reldor/reldor.config.yaml: commite para valer para o time todo.']);
    return 0;
  }
  const { config } = loadConfig(root);
  const report = tools.toolsReport(root, config);
  if (flags.json) printJson(report);
  else print(render(report, config));
  return 0;
}

module.exports = { toolsCommand, render };
