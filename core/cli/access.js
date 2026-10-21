'use strict';

/**
 * reldor access <Objeto.Campo | Objeto | ClasseApex> [--value "<valor>"] [--rt RT1,RT2] [--perms P1,P2] [--json]
 * "Já existe, mas está liberado?": everywhere the metadata has to allow it, and where it is missing.
 */
const { logAction } = require('../log');
const { print, printJson } = require('../report');

async function accessCommand(root, flags, args) {
  const { readProject } = require('../../modules/sf');
  if (!readProject(root)) {
    process.stderr.write('⚠️ sfdx-project.json não encontrado: rode o comando dentro de um projeto Salesforce.\n');
    return 1;
  }
  const target = args[0];
  if (!target) {
    process.stderr.write('⚠️ Diga o que investigar. Ex.: reldor access Opportunity.Status__c --value "Aprovado" --rt Varejo\n');
    return 1;
  }
  const list = (v) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
  const r = require('../../modules/sf/access').accessReport(root, target, { value: typeof flags.value === 'string' ? flags.value : null, recordTypes: list(flags.rt), permissions: list(flags.perms) });
  logAction(root, 'access', { summary: `${target}${r.value ? ` = ${r.value}` : ''}: ${r.gaps.length} ponto(s) a liberar` });
  if (flags.json) {
    printJson(r);
    return 0;
  }
  const out = [`\n🛡️  Acesso: ${target}${r.value ? ` = "${r.value}"` : ''}`, ''];
  if (r.ok.length) out.push('✅ Já está:', ...r.ok.map((o) => `   • ${o}`), '');
  if (r.gaps.length) {
    out.push(`⚠️ Onde falta liberar ou conferir (${r.gaps.length}):`);
    for (const g of r.gaps) out.push(`   • [${g.area}] ${g.what}${g.file ? `\n     ${g.file}` : ''}`);
  } else out.push('Nada faltando no que está no projeto.');
  const d = r.details || {};
  if (d.access && (d.access.none || []).length && !list(flags.perms).length) out.push('', `ℹ️  Sem acesso ao campo: ${d.access.none.length} profile(s)/permission set(s). Para conferir só os da task: --perms Nome1,Nome2`);
  if (d.access && d.permissionFiles === 0) out.push('', 'ℹ️  O projeto não tem profiles nem permission sets: o acesso ao campo (FLS) não foi conferido. Traga os da task no retrieve para conferir.');
  if (d.flexipages && d.flexipages.length) out.push(`ℹ️  Aparece nas páginas: ${d.flexipages.slice(0, 6).join(', ')}`);
  out.push('', 'ℹ️  Vale para o que está no projeto. Se o retrieve não trouxe tudo (profiles, record types), traga antes de concluir.');
  print(out);
  return 0;
}

module.exports = { accessCommand };
