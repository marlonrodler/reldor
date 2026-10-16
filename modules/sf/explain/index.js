'use strict';

const { chainFrom, bypassSwitches, relatedTests } = require('../indexer/query');

const EVENTS = ['insert', 'update', 'delete'];
const EVENT_LABEL = { insert: 'criado (insert)', update: 'atualizado (update)', delete: 'apagado (delete)' };

function flowItem(model, name, event) {
  const f = model.flows[name];
  if (!f || !f.active || !f.events.includes(event)) return null;
  const effects = [];
  if (f.fieldsWritten.length) effects.push(`altera ${f.fieldsWritten.join(', ')}`);
  if (f.creates.length) effects.push(`cria ${f.creates.join(', ')}`);
  if (f.updates.length) effects.push(`atualiza ${f.updates.join(', ')}`);
  if (f.deletes.length) effects.push(`apaga ${f.deletes.join(', ')}`);
  if (f.apexActions.length) effects.push(`chama Apex ${f.apexActions.join(', ')}`);
  if (f.subflows.length) effects.push(`chama o subflow ${f.subflows.join(', ')}`);
  return {
    kind: 'flow',
    name,
    label: f.label,
    conditional: f.conditional,
    condition: f.filterFormula || (f.filters.length ? f.filters.map((x) => `${x.field} ${x.operator}`).join(' e ') : null),
    effects,
    async: f.async,
  };
}

function triggerItems(model, object, timing, event) {
  const o = model.objects[object];
  return o.triggers
    .map((name) => model.triggers[name])
    .filter((t) => t && t.events.includes(`${timing} ${event}`))
    .map((t) => {
      const chain = chainFrom(model, t, `trigger:${t.name}`, 3, { timing, event }, object);
      const handlers = chainFrom(model, t, `trigger:${t.name}`, 1, null, object);
      return { kind: 'trigger', name: t.name, chain, idle: handlers.length > 0 && chain.length === 0 };
    });
}

/**
 * The automations that run when a record of `object` is saved, in Salesforce's order of execution
 * (simplified). Pure data; the CLI and the AI decide how to present it.
 */
function explainObject(model, object, event = 'update') {
  const o = model.objects[object];
  if (!o) return null;
  if (!EVENTS.includes(event)) throw new Error(`Evento inválido: ${event}. Use insert, update ou delete.`);

  const steps = [];
  const add = (title, items, note) => {
    if (items.length) steps.push({ title, items, note: note || null });
  };

  add('Flows antes de salvar (before-save)', o.flows.before.map((n) => flowItem(model, n, event)).filter(Boolean));
  const before = triggerItems(model, object, 'before', event);
  add('Triggers before', before);
  if (event !== 'delete') {
    add(
      'Regras de validação',
      o.validationRules.filter((v) => v.active).map((v) => ({ kind: 'validationRule', name: v.name, fields: v.refs, message: v.message })),
      'Bloqueiam o salvamento se a condição for verdadeira.',
    );
    add('Regras de duplicidade', o.duplicateRules.filter((d) => d.active).map((d) => ({ kind: 'duplicateRule', name: d.name })));
  }
  const after = triggerItems(model, object, 'after', event);
  add('Triggers after', after);
  if (o.workflow && event !== 'delete') {
    const rules = o.workflow.rules.filter((r) => r.active);
    const hasUpdates = o.workflow.fieldUpdates.length > 0;
    add(
      'Workflow rules (legado)',
      rules.map((r) => ({ kind: 'workflowRule', name: r.name })),
      hasUpdates ? `Têm atualização de campo (${o.workflow.fieldUpdates.map((u) => u.field).join(', ')}): os triggers de update rodam mais uma vez.` : null,
    );
  }
  add('Process Builder (legado)', o.flows.process.map((n) => flowItem(model, n, event)).filter(Boolean));
  add('Flows depois de salvar (after-save)', o.flows.after.map((n) => flowItem(model, n, event)).filter(Boolean));
  add(
    'Efeito em cascata',
    o.rollupsTo.map((r) => ({ kind: 'rollup', name: `${r.parent}.${r.field}`, parent: r.parent })),
    'O registro pai é recalculado e salvo também: as automações dele rodam.',
  );

  const chainClasses = [...before, ...after].flatMap((t) => t.chain.map((c) => c.name));
  const asyncByName = new Map();
  for (const c of [...before, ...after].flatMap((t) => t.chain)) {
    const cls = model.classes[c.name];
    for (const job of (cls && cls.enqueues) || []) asyncByName.set(job, { kind: 'class', name: job, from: c.name });
    if (c.kinds.includes('queueable') || c.kinds.includes('batch')) asyncByName.set(c.name, { kind: 'class', name: c.name, from: c.via });
  }
  const asyncItems = [
    ...asyncByName.values(),
    ...[...o.flows.before, ...o.flows.after].map((n) => flowItem(model, n, event)).filter((f) => f && f.async),
  ];
  add('Assíncrono (depois do commit)', asyncItems, 'Roda em outra transação: erros aqui não desfazem o salvamento.');

  const dynamicSources = [...new Set([...before, ...after].flatMap((t) => t.chain.filter((c) => c.dynamic).map((c) => c.via.split(' ')[0])))];
  const inactiveFlows = [...o.flows.before, ...o.flows.after, ...o.flows.process].filter((n) => model.flows[n] && !model.flows[n].active);
  return {
    object,
    event,
    steps,
    bypass: bypassSwitches(model, chainClasses).filter((b) => !dynamicSources.includes(b)),
    dynamicSources,
    tests: relatedTests(model, object, [...chainClasses, ...before.map((t) => t.name)]),
    alsoWrittenBy: o.writtenBy.filter((c) => !chainClasses.includes(c)),
    lwcs: o.lwcs,
    recordTypes: o.recordTypes.filter((r) => r.active).map((r) => r.name),
    inactiveFlows,
  };
}

function renderExplain(r) {
  const out = [`\n🛡️  O que acontece quando um registro de ${r.object} é ${EVENT_LABEL[r.event]}`, ''];
  if (!r.steps.length) out.push('Nenhuma automação encontrada no código para este evento.');
  r.steps.forEach((step, i) => {
    out.push(`${i + 1}. ${step.title}`);
    for (const item of step.items) {
      let line = `   • ${item.name}`;
      if (item.kind === 'flow') {
        if (item.conditional) line += ` (condicional${item.condition ? `: ${item.condition}` : ''})`;
        if (item.effects.length) line += ` → ${item.effects.join('; ')}`;
      }
      if (item.kind === 'trigger' && item.idle) line += ' (o handler não tem lógica para esta fase)';
      if (item.kind === 'class' && item.from) line += ` (disparado por ${item.from})`;
      if (item.kind === 'validationRule' && item.fields.length) line += ` (usa ${item.fields.join(', ')})`;
      out.push(line);
      if (item.kind === 'trigger') {
        for (const c of item.chain) out.push(`   ${'  '.repeat(c.level)}↳ ${c.name}${c.kinds.length ? ` [${c.kinds.join(', ')}]` : ''}${c.dynamic ? ` (dinâmico, via ${c.via})` : ''}`);
      }
    }
    if (step.note) out.push(`   ⚠️ ${step.note}`);
    out.push('');
  });
  if (r.bypass.length) out.push(`🔌 Bypass possível: ${r.bypass.join(', ')} (o código consulta essas configurações).`);
  if (r.recordTypes.length) out.push(`🏷️  Record types ativos: ${r.recordTypes.join(', ')}`);
  if (r.alsoWrittenBy.length) out.push(`✍️  Também gravam ${r.object}: ${r.alsoWrittenBy.join(', ')}`);
  if (r.lwcs.length) out.push(`🖥️  Telas (LWC) que usam ${r.object}: ${r.lwcs.join(', ')}`);
  if (r.dynamicSources.length) out.push(`🧩 Handlers carregados por custom metadata: ${r.dynamicSources.join(', ')} (conferir os registros na org).`);
  if (r.tests.direct.length) out.push(`🧪 Testes que usam esta cadeia: ${r.tests.direct.join(', ')}`);
  if (r.tests.byObject.length) out.push(`🧪 Mais ${r.tests.byObject.length} teste(s) criam ou alteram ${r.object} e podem ser afetados.`);
  if (r.inactiveFlows.length) out.push(`💤 Flows inativos ignorados: ${r.inactiveFlows.join(', ')}`);
  out.push('', 'ℹ️  Ordem de execução simplificada, montada a partir do código do projeto. Pacotes gerenciados e');
  out.push('   automações criadas direto na org (fora do repositório) não aparecem aqui.');
  return out;
}

module.exports = { explainObject, renderExplain, EVENTS };
