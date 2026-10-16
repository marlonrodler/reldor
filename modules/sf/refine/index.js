'use strict';

/**
 * Task refinement: the facts behind a task idea. The AI reads the idea; this module returns what exists
 * around the objects and fields it touches, so the task is written with the real impact in view.
 */
const { explainObject } = require('../explain');
const { findUsages } = require('../checks/usages');

/** Standard object names people write in Portuguese or English. */
const STANDARD_WORDS = {
  account: 'Account', conta: 'Account', contas: 'Account',
  opportunity: 'Opportunity', oportunidade: 'Opportunity', oportunidades: 'Opportunity',
  contact: 'Contact', contato: 'Contact', contatos: 'Contact',
  case: 'Case', caso: 'Case', casos: 'Case', chamado: 'Case', chamados: 'Case',
  lead: 'Lead', leads: 'Lead', candidato: 'Lead',
  task: 'Task', tarefa: 'Task', tarefas: 'Task',
  event: 'Event', evento: 'Event', eventos: 'Event',
  product: 'Product2', produto: 'Product2', produtos: 'Product2',
  quote: 'Quote', cotacao: 'Quote', cotacoes: 'Quote',
  contract: 'Contract', contrato: 'Contract', contratos: 'Contract',
  order: 'Order', pedido: 'Order', pedidos: 'Order',
  campaign: 'Campaign', campanha: 'Campaign', campanhas: 'Campaign',
  user: 'User', usuario: 'User', usuarios: 'User',
};

function norm(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Objects and fields mentioned in free text, by API name, label or common word. */
function detectMentions(model, text) {
  const t = norm(text);
  const words = new Set(t.split(/[^a-z0-9_]+/).filter(Boolean));
  const objects = new Set();
  const fields = new Set();

  for (const o of Object.values(model.objects)) {
    if (o.customSetting || o.customMetadata) continue;
    const api = norm(o.name);
    const label = norm(o.label);
    if (words.has(api) || (label && label.length > 3 && t.includes(label))) objects.add(o.name);
  }
  for (const w of words) if (STANDARD_WORDS[w] && model.objects[STANDARD_WORDS[w]]) objects.add(STANDARD_WORDS[w]);
  for (const m of String(text).matchAll(/\b(\w+)\.(\w+__c)\b/g)) {
    if (model.objects[m[1]]) objects.add(m[1]);
    fields.add(`${m[1]}.${m[2]}`);
  }
  for (const o of Object.values(model.objects)) {
    for (const f of Object.values(o.fields)) {
      const api = norm(f.name);
      const label = norm(f.label);
      const bare = api.replace(/__c$/, '');
      const byValue = (f.picklist || []).some((v) => norm(v).length > 3 && words.has(norm(v)));
      const loose = (bare.length >= 3 && words.has(bare)) || (label && label.length > 4 && t.includes(label)) || byValue;
      if (words.has(api) || (loose && objects.has(o.name))) {
        fields.add(`${o.name}.${f.name}`);
        objects.add(o.name);
      }
    }
  }
  return { objects: [...objects], fields: [...fields] };
}

function objectFacts(model, name) {
  const o = model.objects[name];
  const ins = explainObject(model, name, 'insert');
  const upd = explainObject(model, name, 'update');
  const activeFlows = [...o.flows.before, ...o.flows.after, ...o.flows.process].filter((f) => model.flows[f]?.active);
  const chain = [...new Set([...ins.steps, ...upd.steps].flatMap((s) => s.items).filter((i) => i.kind === 'trigger').flatMap((i) => i.chain.map((c) => c.name)))];
  const tests = new Set([...ins.tests.direct, ...ins.tests.byObject, ...upd.tests.direct, ...upd.tests.byObject]);
  return {
    name,
    label: o.label,
    exists: Object.keys(o.fields).length > 0 || o.triggers.length > 0 || activeFlows.length > 0 || Boolean(model.objects[name]),
    triggers: o.triggers,
    handlerChain: chain,
    flows: activeFlows,
    validationRules: o.validationRules.filter((v) => v.active).map((v) => v.name),
    recordTypes: o.recordTypes.filter((r) => r.active).map((r) => r.name),
    workflowRules: (o.workflow?.rules || []).filter((r) => r.active).map((r) => r.name),
    rollupsTo: o.rollupsTo.map((r) => r.parent),
    parents: o.parents.map((p) => p.parent),
    selectors: o.selectors,
    lwcs: o.lwcs,
    writtenBy: o.writtenBy,
    bypass: [...new Set([...ins.bypass, ...upd.bypass])],
    tests: [...tests],
  };
}

function fieldFacts(model, ref) {
  const [object, field] = ref.split('.');
  const def = model.objects[object]?.fields[field];
  const uses = def ? findUsages(model, ref) : [];
  return {
    ref,
    exists: Boolean(def),
    type: def?.type || null,
    required: def?.required || false,
    picklist: def?.picklist || null,
    usedIn: uses.length,
    usages: uses.slice(0, 15),
  };
}

/** Attention points and open questions, from the facts only. */
function questionsFor(objects, fields, text) {
  const attention = [];
  const questions = [];
  const t = norm(text);
  for (const o of objects) {
    if (o.triggers.length) attention.push(`${o.name} já tem a trigger ${o.triggers.join(', ')}: a lógica nova entra no handler, sem criar outra trigger.`);
    if (o.flows.length) attention.push(`${o.name} tem ${o.flows.length} flow(s) ativo(s) (${o.flows.join(', ')}): confira se algum já faz algo parecido ou grava os mesmos campos.`);
    if (o.validationRules.length) attention.push(`${o.name} tem ${o.validationRules.length} validation rule(s) ativa(s): a regra nova não pode conflitar com ${o.validationRules.slice(0, 5).join(', ')}.`);
    if (o.workflowRules.length) attention.push(`${o.name} ainda tem workflow rules (legado): ${o.workflowRules.join(', ')}.`);
    if (o.rollupsTo.length) attention.push(`Salvar ${o.name} recalcula ${o.rollupsTo.join(', ')} (roll-up): as automações de lá também rodam.`);
    if (o.tests.length) attention.push(`${o.tests.length} classe(s) de teste criam ou usam ${o.name}: o radar de testes vai apontar quais rodar.`);
    if (o.bypass.length) questions.push(`O bypass ${o.bypass.join(', ')} deve desligar a regra nova também?`);
    if (o.recordTypes.length > 1) questions.push(`Vale para todos os record types de ${o.name} (${o.recordTypes.join(', ')}) ou só para alguns?`);
    questions.push(`O que acontece com os registros de ${o.name} que já existem?`);
    if (o.lwcs.length) questions.push(`As telas ${o.lwcs.join(', ')} mostram ${o.name}: precisam mudar?`);
  }
  for (const f of fields) {
    if (!f.exists) questions.push(`O campo ${f.ref} não existe: será criado? Qual tipo, é obrigatório e quem pode ver ou editar (FLS)?`);
    else if (f.picklist) questions.push(`${f.ref} é picklist (${f.picklist.join(', ')}): a regra vale para quais valores?`);
  }
  if (!/\d/.test(t)) questions.push('Qual o volume esperado (registros por transação ou por dia)? Isso decide entre flow, trigger e processamento assíncrono.');
  questions.push('Quem usa: quais perfis ou permission sets precisam do acesso novo?');
  questions.push('Como deve ser a mensagem de erro, e em que campo ela aparece?');
  return { attention, questions: [...new Set(questions)] };
}

/** A rough size signal from how many pieces the task touches. Not an estimate of hours. */
function sizeSignal(objects, fields) {
  const pieces = objects.reduce((n, o) => n + 1 + o.triggers.length + o.flows.length + o.validationRules.length + o.handlerChain.length + o.lwcs.length + o.rollupsTo.length, 0)
    + fields.filter((f) => !f.exists).length * 2 + fields.reduce((n, f) => n + Math.min(f.usedIn, 5), 0);
  const size = pieces <= 6 ? 'pequeno' : pieces <= 18 ? 'médio' : 'grande';
  return { size, pieces };
}

function refineBrief(model, { text = '', objects = [], fields = [] }) {
  const detected = detectMentions(model, text);
  const objectNames = [...new Set([...objects, ...detected.objects, ...fields.map((f) => f.split('.')[0])])].filter((o) => model.objects[o]);
  const unknownObjects = [...new Set(objects)].filter((o) => !model.objects[o]);
  const fieldRefs = [...new Set([...fields, ...detected.fields])];
  const objs = objectNames.map((o) => objectFacts(model, o));
  const flds = fieldRefs.map((f) => fieldFacts(model, f));
  return {
    text,
    detected,
    unknownObjects,
    objects: objs,
    fields: flds,
    ...questionsFor(objs, flds, text),
    signal: sizeSignal(objs, flds),
  };
}

function renderBrief(b) {
  const out = ['\n🛡️  Refinamento: o que existe em volta desta task', ''];
  if (!b.objects.length) {
    out.push('Não identifiquei objetos do projeto no texto. Informe com --objects Objeto1,Objeto2.');
    return out;
  }
  for (const o of b.objects) {
    out.push(`📦 ${o.name}${o.label && o.label !== o.name ? ` (${o.label})` : ''}`);
    out.push(`   triggers: ${o.triggers.join(', ') || 'nenhuma'}${o.handlerChain.length ? ` → ${o.handlerChain.join(', ')}` : ''}`);
    out.push(`   flows ativos: ${o.flows.join(', ') || 'nenhum'} · validation rules: ${o.validationRules.length} · record types: ${o.recordTypes.join(', ') || 'nenhum'}`);
    if (o.rollupsTo.length) out.push(`   cascata: recalcula ${o.rollupsTo.join(', ')}`);
    if (o.lwcs.length) out.push(`   telas: ${o.lwcs.join(', ')}`);
    out.push(`   testes que tocam o objeto: ${o.tests.length}`);
  }
  for (const f of b.fields) {
    out.push(`🔤 ${f.ref}: ${f.exists ? `existe (${f.type}${f.required ? ', obrigatório' : ''}), usado em ${f.usedIn} lugar(es)` : 'não existe ainda'}`);
  }
  if (b.unknownObjects.length) out.push(`⚠️ Não encontrei no projeto: ${b.unknownObjects.join(', ')}`);
  out.push('', 'Pontos de atenção:', ...(b.attention.length ? b.attention.map((a) => `   ⚠️ ${a}`) : ['   nenhum']));
  out.push('', 'Perguntas em aberto:', ...b.questions.map((q, i) => `   ${i + 1}. ${q}`));
  out.push('', `📏 Tamanho (sinal, não estimativa): ${b.signal.size} · ${b.signal.pieces} peça(s) envolvida(s)`);
  out.push('', 'ℹ️  Peça à IA para transformar isto na task: o que muda, critérios de aceite e cenários de teste.');
  return out;
}

module.exports = { refineBrief, renderBrief, detectMentions, STANDARD_WORDS };
