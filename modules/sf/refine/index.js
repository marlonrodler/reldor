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

const { STOPWORDS, meanings, singulars, ABBREVIATIONS } = require('./words');

const NAME_NOISE = new Set(['npsp', 'hed', 'deprecated', 'the', 'of', 'and', 'c', 'e', 'mdt', 'x']);

/** Words of a name: "ServiceDelivery__c", "Course_Offering__c", "npe01__OppPayment__c", "GAU Allocation". */
function nameWords(name) {
  const bare = String(name || '').replace(/^[a-z0-9]+__(?=.*__)/i, '').replace(/__(c|e|mdt|x|b)$/i, '');
  return norm(bare.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_\-./]+/g, ' '))
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !NAME_NOISE.has(w))
    .map((w) => (ABBREVIATIONS[w] ? ABBREVIATIONS[w] : w))
    .join(' ')
    .split(' ')
    .filter(Boolean);
}

/** The different ways an object or field is named: label, plural label, API name. */
function phrasesOf(item) {
  const list = [item.label, item.pluralLabel, item.name].filter(Boolean).map(nameWords).filter((p) => p.length);
  const seen = new Set();
  return list.filter((p) => {
    const k = p.join(' ');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** The written words of a request with all their meanings (singular, translations). */
function requestWords(text) {
  const out = [];
  let afterOf = false;
  for (const w of norm(text).split(/[^a-z0-9_]+/).filter(Boolean)) {
    if (STOPWORDS.has(w)) {
      afterOf = afterOf || /^(de|do|da|dos|das|of)$/.test(w);
      continue;
    }
    // afterOf: this word completes the one before ("lote de doações"), it is not a subject of its own
    out.push({ word: w, pos: out.length, meanings: meanings(w), afterOf });
    afterOf = false;
  }
  return out;
}

/** Best place in the request where every word of a name appears close together (any order, one extra word allowed). */
function findPhrase(words, phrase, taken = new Set()) {
  const hits = phrase.map((p) => words.filter((w) => singulars(p).some((s) => w.meanings.has(s))).map((w) => w.pos));
  if (hits.some((h) => !h.length)) return null;
  let best = null;
  const walk = (i, chosen) => {
    if (i === hits.length) {
      const span = Math.max(...chosen) - Math.min(...chosen);
      if (span > phrase.length) return; // the words must sit together (one extra word allowed)
      const free = chosen.filter((c) => !taken.has(c)).length;
      if (!best || span < best.span || (span === best.span && free > best.free)) best = { positions: [...chosen], span, free };
      return;
    }
    for (const pos of hits[i]) if (!chosen.includes(pos)) walk(i + 1, [...chosen, pos]);
  };
  walk(0, []);
  return best;
}

/**
 * Objects and fields a request talks about, in Portuguese or English, by label, API name or common word.
 * Longer names win over the shorter names they contain ("entrega de serviço" is Service Delivery, not Service);
 * the contained ones are kept as `related`.
 */
function detectMentions(model, text) {
  const words = requestWords(text);
  const raw = String(text);
  const candidates = [];
  // Standard objects count even when the project has no metadata for them.
  const { STANDARD } = require('../checks/fieldresolve');
  const customPhrases = new Set(Object.values(model.objects).flatMap((o) => phrasesOf(o).map((p) => p.join(' '))));
  // A standard object the project replaced with its own (Address__c, Order__c named "Order") stays out.
  const standardOnly = [...STANDARD].filter((n) => !model.objects[n]).map((n) => ({ name: n, label: n.replace(/([a-z])([A-Z])/g, '$1 $2'), fields: {}, standardOnly: true })).filter((o) => !phrasesOf(o).some((p) => customPhrases.has(p.join(' '))));
  const pool = [...Object.values(model.objects), ...standardOnly];
  for (const o of pool) {
    const config = o.customSetting || o.customMetadata;
    const deprecated = /deprecated/i.test(o.label || '');
    for (const phrase of phrasesOf(o)) {
      // A one-word name of a settings object or a deprecated one only counts when written as is.
      if ((config || deprecated) && phrase.length < 2) continue;
      const m = findPhrase(words, phrase);
      if (m) candidates.push({ object: o.name, phrase, ...m, score: phrase.length * 10 - m.span - (deprecated ? 5 : 0) - (config ? 3 : 0) });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.object.localeCompare(b.object));
  const taken = new Set();
  const objects = [];
  const related = [];
  const why = {};
  for (const c of candidates) {
    if (objects.includes(c.object) || related.includes(c.object)) continue;
    if (c.positions.every((p) => taken.has(p))) {
      related.push(c.object);
      continue;
    }
    objects.push(c.object);
    why[c.object] = c.positions.map((p) => words.find((w) => w.pos === p).word).join(' + ');
    for (const p of c.positions) taken.add(p);
    if (/__e$/i.test(c.object)) {
      // "evento de pacote submetido": the word "event" next to a platform event's name is part of it
      const lo = Math.min(...c.positions);
      const ev = words.find((w) => w.pos === lo - 1 && w.meanings.has('event'));
      if (ev) taken.add(ev.pos);
    }
  }
  // A name said by its last word only ("o cronograma" when Service Schedule is the only *schedule*): a lighter match
  const loose = {};
  for (const w of words) {
    if (taken.has(w.pos)) continue;
    if (w.afterOf && taken.has(w.pos - 1)) continue; // "lote de doações": the batch, not a donation object
    const owners = pool.filter((o) => !o.customSetting && !o.customMetadata && !/deprecated/i.test(o.label || '') && phrasesOf(o).some((ph) => ph.length > 1 && singulars(ph[ph.length - 1]).some((s) => w.meanings.has(s))));
    let names = [...new Set(owners.map((o) => o.name))];
    if (names.length > 1) {
      // Several names end with that word: keep the one whose other words the request also uses, if only one does.
      const overlap = (o) => Math.max(...phrasesOf(o).map((ph) => ph.slice(0, -1).filter((t) => words.some((x) => singulars(t).some((s) => x.meanings.has(s)))).length));
      const scored = owners.map((o) => [o.name, overlap(o)]).sort((a, b) => b[1] - a[1]);
      if (scored[0][1] > 0 && (scored.length === 1 || scored[1][1] < scored[0][1])) names = [scored[0][0]];
    }
    if (names.length === 1 && !objects.includes(names[0])) {
      objects.push(names[0]);
      loose[names[0]] = w.word;
      why[names[0]] = `${w.word} (só ${names[0]} tem esse nome)`;
      taken.add(w.pos);
    }
  }
  // Written in full: Object__c or Object__c.Field__c
  for (const m of raw.matchAll(/\b([A-Za-z]\w*__(?:c|e))\b/g)) if (model.objects[m[1]] && !objects.includes(m[1])) objects.push(m[1]);
  const fields = new Set();
  for (const m of raw.matchAll(/\b(\w+)\.(\w+__c)\b/g)) {
    if (model.objects[m[1]] && !objects.includes(m[1])) objects.push(m[1]);
    fields.add(`${m[1]}.${m[2]}`);
  }
  // Fields of the objects found, named by words the object names did not use
  for (const name of objects) {
    const o = model.objects[name];
    if (!o) continue;
    for (const f of Object.values(o.fields)) {
      const byValue = (f.picklist || []).some((v) => norm(v).length > 3 && words.some((w) => w.word === norm(v)));
      const exact = words.some((w) => w.word === norm(f.name));
      let byName = false;
      for (const phrase of phrasesOf(f)) {
        const m = findPhrase(words, phrase, taken);
        if (m && m.free === m.positions.length) byName = true;
      }
      if (exact || byName || byValue) fields.add(`${name}.${f.name}`);
    }
  }
  return { objects, fields: [...fields], related: related.filter((r) => !objects.includes(r)), why, loose: Object.keys(loose) };
}

function objectFacts(model, name) {
  const o = model.objects[name];
  if (!o) {
    // A standard object with no metadata in the project: it exists in the org, nothing of it is customized here.
    return { name, label: name, exists: true, standardOnly: true, triggers: [], handlerChain: [], flows: [], validationRules: [], recordTypes: [], workflowRules: [], rollupsTo: [], parents: [], selectors: [], lwcs: [], writtenBy: [], bypass: [], tests: [] };
  }
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

/**
 * Rules that already exist and look like the request: an active validation rule or a flow of the same objects
 * whose name, fields or message share at least two of the request's words (in any language).
 */
function similarRules(model, objectNames, text) {
  const req = new Set(requestWords(text).flatMap((w) => [...w.meanings]));
  const words = (s) => nameWords(s).flatMap((w) => singulars(w));
  const out = [];
  for (const name of objectNames) {
    const o = model.objects[name];
    if (!o) continue;
    for (const v of o.validationRules.filter((x) => x.active)) {
      const own = new Set([...words(v.name), ...v.refs.flatMap((r) => words(r.split('.').pop())), ...nameWords(v.message || '').flatMap((w) => [...meanings(w)])]);
      const shared = [...own].filter((w) => w.length > 2 && req.has(w));
      if (shared.length >= 2) out.push({ kind: 'validation rule', object: name, name: v.name, shared, message: v.message });
    }
    for (const f of [...o.flows.before, ...o.flows.after]) {
      const flow = model.flows[f];
      if (!flow || !flow.active) continue;
      const own = new Set([...words(flow.name), ...words(flow.label || ''), ...(flow.fieldsWritten || []).flatMap((x) => words(x))]);
      const shared = [...own].filter((w) => w.length > 2 && req.has(w));
      if (shared.length >= 2) out.push({ kind: 'flow', object: name, name: flow.name, shared });
    }
  }
  return out;
}

function refineBrief(model, { text = '', objects = [], fields = [] }) {
  const detected = detectMentions(model, text);
  const { STANDARD } = require('../checks/fieldresolve');
  const known = (o) => Boolean(model.objects[o]) || STANDARD.has(o);
  const objectNames = [...new Set([...objects, ...detected.objects, ...fields.map((f) => f.split('.')[0])])].filter(known);
  const unknownObjects = [...new Set(objects)].filter((o) => !known(o));
  const fieldRefs = [...new Set([...fields, ...detected.fields])];
  const objs = objectNames.map((o) => objectFacts(model, o));
  const flds = fieldRefs.map((f) => fieldFacts(model, f));
  const similar = similarRules(model, objectNames, text);
  const qa = questionsFor(objs, flds, text);
  for (const s of similar) qa.attention.unshift(`Já existe algo parecido: a ${s.kind} ${s.object}.${s.name} (fala de ${s.shared.join(', ')})${s.message ? ` — "${s.message}"` : ''}. Confira se a task é ajustar essa regra em vez de criar outra.`);
  return {
    text,
    detected,
    similar,
    unknownObjects,
    objects: objs,
    fields: flds,
    ...qa,
    signal: sizeSignal(objs, flds),
  };
}

function renderBrief(b) {
  const out = ['\n🛡️  Refinamento: o que existe em volta desta task', ''];
  if (!b.objects.length) {
    out.push('Não identifiquei objetos do projeto no texto. Informe com --objects Objeto1,Objeto2.');
    return out;
  }
  const why = (b.detected && b.detected.why) || {};
  const loose = new Set((b.detected && b.detected.loose) || []);
  if (Object.keys(why).length) {
    out.push('Entendi assim (confira):');
    for (const o of b.objects) if (why[o.name]) out.push(`   "${why[o.name]}" → ${o.name}${loose.has(o.name) ? ' (pela última palavra do nome; confirme)' : ''}`);
    if (b.detected.related && b.detected.related.length) out.push(`   Citados dentro de outro nome: ${b.detected.related.join(', ')} (entram só se a task mexer neles também)`);
    out.push('   Se faltou ou sobrou algum, rode de novo com --objects Objeto1,Objeto2.', '');
  }
  for (const o of b.objects) {
    out.push(`📦 ${o.name}${o.label && o.label !== o.name ? ` (${o.label})` : ''}`);
    if (o.standardOnly) {
      out.push('   objeto padrão sem nada customizado no projeto (sem trigger, flow ou validation rule aqui)');
      continue;
    }
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
