'use strict';

/**
 * The targets of a task, as the AI wrote them in the task's front matter (human names or API names), turned into
 * API names with how sure the match is. Only the targets are looked up, never every word of the text: that is what
 * keeps the refinement free of noise. A doubt is reported only when two candidates are really close.
 */
const { nameWords, norm } = require('./index');
const { meanings } = require('./words');

/** The words of a name with their translations (pt ↔ en), for comparing labels. */
function wordSet(text) {
  const out = new Set();
  for (const w of nameWords(text)) for (const m of meanings(w)) out.add(m);
  return out;
}

/** How alike two names are, word by word (a word matches if any translation matches): 1 = same words. */
function likeness(a, b) {
  const A = nameWords(a);
  const B = nameWords(b);
  if (!A.length || !B.length) return 0;
  const BM = B.map((w) => new Set(meanings(w)));
  const used = new Set();
  let hits = 0;
  for (const w of A) {
    const mine = new Set(meanings(w));
    const j = BM.findIndex((m, i) => !used.has(i) && [...mine].some((x) => m.has(x)));
    if (j >= 0) {
      used.add(j);
      hits += 1;
    }
  }
  return hits / Math.max(A.length, B.length);
}

/**
 * Standard fields people name by their label, which a retrieve usually does not bring as files. Salesforce's own
 * names (the same in every org), so a task saying "Stage" or "Data de fechamento" finds StageName or CloseDate.
 */
const STANDARD_FIELDS = {
  Opportunity: { StageName: 'Stage Fase Etapa', CloseDate: 'Close Date Data de fechamento', Amount: 'Amount Valor', Probability: 'Probability Probabilidade', Type: 'Type Tipo', LeadSource: 'Lead Source Origem do lead', Name: 'Name Nome', OwnerId: 'Owner Proprietário', AccountId: 'Account Conta' },
  Account: { Name: 'Name Nome', Type: 'Type Tipo', Industry: 'Industry Setor', Phone: 'Phone Telefone', OwnerId: 'Owner Proprietário', ParentId: 'Parent Account Conta pai' },
  Contact: { FirstName: 'First Name Nome', LastName: 'Last Name Sobrenome', Email: 'Email', Phone: 'Phone Telefone', AccountId: 'Account Conta', OwnerId: 'Owner Proprietário' },
  Case: { Status: 'Status', Priority: 'Priority Prioridade', Origin: 'Origin Origem', Subject: 'Subject Assunto', Type: 'Type Tipo', Reason: 'Reason Motivo', OwnerId: 'Owner Proprietário' },
  Lead: { Status: 'Status', LeadSource: 'Lead Source Origem', Company: 'Company Empresa', Email: 'Email', OwnerId: 'Owner Proprietário' },
  Task: { Status: 'Status', Priority: 'Priority Prioridade', Subject: 'Subject Assunto', ActivityDate: 'Due Date Data de vencimento' },
};

/** Candidates for one field name among the given objects (or all), best first. */
function fieldCandidates(model, name, objects = []) {
  const raw = String(name).trim();
  const [maybeObj, maybeField] = raw.includes('.') ? raw.split('.', 2) : [null, raw];
  const pool = Object.values(model.objects || {}).filter((o) => (maybeObj ? o.name === maybeObj : !objects.length || objects.includes(o.name)));
  const out = [];
  for (const o of pool) {
    for (const f of Object.values(o.fields || {})) {
      const ref = `${o.name}.${f.name}`;
      let score = 0;
      if (f.name.toLowerCase() === maybeField.toLowerCase()) score = 1;
      else if (f.label && norm(f.label) === norm(maybeField)) score = 0.95;
      else score = Math.max(likeness(maybeField, f.label || ''), likeness(maybeField, f.name)) * 0.9;
      if (score >= 0.5) out.push({ ref, label: f.label || f.name, type: f.type, score: Math.round(score * 100) / 100 });
    }
  }
  // Standard fields of the objects in the task, when the project has no file for them.
  const objectsToTry = maybeObj ? [maybeObj] : objects.length ? objects : Object.keys(STANDARD_FIELDS);
  for (const o of objectsToTry) {
    for (const [api, labels] of Object.entries(STANDARD_FIELDS[o] || {})) {
      const ref = `${o}.${api}`;
      if (out.some((x) => x.ref === ref)) continue;
      const parts = labels.split(/\s(?=[A-Z])/);
      const score = api.toLowerCase() === maybeField.toLowerCase() ? 1 : Math.max(...parts.map((l) => (norm(l) === norm(maybeField) ? 0.95 : likeness(maybeField, l) * 0.9)));
      if (score >= 0.5) out.push({ ref, label: `${parts[0]} (campo padrão)`, type: 'padrão', score: Math.round(score * 100) / 100 });
    }
  }
  return out.sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref)).slice(0, 5);
}

/** One resolved target: the API name, or a doubt between close candidates, or not found. */
function decide(asked, candidates) {
  if (!candidates.length) return { asked, status: 'não achei', candidates: [] };
  const [a, b] = candidates;
  if (a.score >= 0.95 && (!b || b.score < 0.95)) return { asked, status: 'certo', ref: a.ref, label: a.label, candidates: [] };
  if (b && a.score - b.score < 0.1) return { asked, status: 'dúvida', candidates: candidates.slice(0, 3) };
  return { asked, status: 'provável', ref: a.ref, label: a.label, candidates: candidates.slice(1, 3) };
}

/** Objects by API name or label. */
function objectCandidates(model, name) {
  const out = [];
  for (const o of Object.values(model.objects || {})) {
    let score = 0;
    if (o.name.toLowerCase() === String(name).toLowerCase()) score = 1;
    else if (o.label && norm(o.label) === norm(name)) score = 0.95;
    else score = Math.max(likeness(name, o.label || ''), likeness(name, o.name)) * 0.9;
    if (score >= 0.5) out.push({ ref: o.name, label: o.label || o.name, score: Math.round(score * 100) / 100 });
  }
  const { STANDARD } = require('../checks/fieldresolve');
  if (!out.length && STANDARD.has(String(name))) out.push({ ref: String(name), label: String(name), score: 1 });
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => (typeof x === 'string' ? x : x)).filter(Boolean);

/**
 * Resolves the front-matter targets: objetos, campos, valores [{campo, valor}], record_types, criar (left as they are:
 * the reuse search handles them). Returns the API names to search with and the doubts to ask about.
 */
function resolveTargets(model, alvos = {}) {
  const objects = list(alvos.objetos || alvos.objects).map((o) => decide(o, objectCandidates(model, o)));
  const objectNames = objects.filter((o) => o.ref).map((o) => o.ref);
  const fields = list(alvos.campos || alvos.fields).map((f) => decide(f, fieldCandidates(model, f, objectNames)));
  const values = list(alvos.valores || alvos.values).map((v) => {
    const field = decide(v.campo || v.field, fieldCandidates(model, v.campo || v.field, objectNames));
    return { field, value: String(v.valor ?? v.value ?? '') };
  });
  const allObjects = [...new Set([...objectNames, ...fields.filter((f) => f.ref).map((f) => f.ref.split('.')[0]), ...values.filter((v) => v.field.ref).map((v) => v.field.ref.split('.')[0])])];
  const doubts = [...objects, ...fields, ...values.map((v) => v.field)].filter((x) => x.status === 'dúvida' || x.status === 'não achei');
  return {
    objects,
    fields,
    values,
    recordTypes: list(alvos.record_types || alvos.recordTypes),
    permissions: list(alvos.perfis || alvos.permissions),
    create: list(alvos.criar || alvos.create).filter((c) => typeof c === 'object'),
    search: {
      objects: allObjects,
      fields: [...new Set(fields.filter((f) => f.ref).map((f) => f.ref))],
      values: values.filter((v) => v.field.ref && v.value).map((v) => `${v.field.ref}=${v.value}`),
    },
    doubts,
  };
}

const SECTIONS = ['objetivo', 'onde', 'o que muda', 'critérios de aceite'];

/**
 * Is the text already a task in the standard? Front matter with targets, and the main sections. Text without them is
 * rewritten by the AI first (with the template), so the search uses the targets and not every word.
 */
function taskFormat(text) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(String(text).replace(/\r\n/g, '\n'));
  let meta = null;
  if (fm) {
    try {
      meta = require('yaml').parse(fm[1]) || null;
    } catch {
      meta = null;
    }
  }
  const body = fm ? String(text).slice(fm[0].length) : String(text);
  const heads = [...body.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => norm(m[1]).trim());
  const missing = SECTIONS.filter((s) => !heads.some((h) => h.startsWith(norm(s))));
  const alvos = meta && (meta.alvos || meta.targets);
  return { standard: Boolean(alvos) && missing.length === 0, hasTargets: Boolean(alvos), missingSections: missing, meta, body, alvos: alvos || null };
}

module.exports = { resolveTargets, taskFormat, fieldCandidates, objectCandidates, likeness, wordSet };
