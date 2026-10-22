'use strict';

/**
 * "Before creating it, does it already exist?" For each item a task asks to create (field, object, class/method,
 * flow, LWC), what the project already has with the same meaning, with the facts that decide between:
 *   reusar    the same meaning, shared or of the person's own team, and nothing of another team depends on it;
 *   generico  it is specific to another team (their prefix, their automations): do not touch theirs, create a generic
 *             shared one and offer it to them;
 *   criar     nothing close enough.
 * Renaming what exists is never suggested: in a big org it breaks reports, integrations and other teams' code.
 * Names only: whether two things mean the same is for the person to confirm. Facts by script; the AI explains.
 */
const { likeness } = require('./refine/targets');
const teams = require('./teams');

/** Who uses a metadata item and how many of those are automations (code, flows, rules, formulas). */
function usageFacts(model, ref) {
  const { findUsages } = require('./checks/usages');
  let uses = [];
  try {
    uses = findUsages(model, ref);
  } catch {
    uses = [];
  }
  const auto = uses.filter((u) => /apex|trigger|flow|validation|fórmula|formula|workflow|process/i.test(u.where));
  const owners = [...new Set(auto.map((u) => teams.ownerOf(u.name, usageFacts.teams || [])).filter(Boolean))];
  return { uses: uses.length, automations: auto.length, automationOwners: owners, examples: auto.slice(0, 4).map((u) => `${u.where} ${u.name}`) };
}

/** The suggestion from the facts: reuse, generic or create. */
function suggestion(c, myTeam) {
  const mine = myTeam ? String(myTeam).toLowerCase() : null;
  const owner = c.owner;
  const othersDepend = c.usage.automationOwners.filter((o) => o.toLowerCase() !== mine);
  // Owned by another team: do not touch theirs; a generic shared one is offered to them.
  if (owner && owner.toLowerCase() !== mine) return { pick: 'generico', why: `é do time ${owner}${c.usage.automations ? ` e tem ${c.usage.automations} automação(ões) usando` : ''}: não mexer no deles; criar um genérico compartilhado e oferecer para eles` };
  // Shared (or yours): reuse it. Other teams' automations are a caution, not a reason to duplicate it.
  if (othersDepend.length) return { pick: 'reusar', why: `já é compartilhado: reusar, sem mudar o comportamento, porque automações de ${othersDepend.join(', ')} dependem dele` };
  return { pick: 'reusar', why: owner ? 'é do seu time' : c.usage.automations ? `compartilhado; ${c.usage.automations} automação(ões) usam: confira se o seu uso não muda o comportamento delas` : 'compartilhado e sem automação dependendo: reusar é o mais seguro' };
}

/** The ways an item is described (its name, what it means): each one is compared on its own. */
const meaningsOf = (item) => [item.nome || item.name, item.sentido || item.meaning || item.descricao].filter(Boolean);
/** Best likeness between any description of the item and a name. */
const best = (item, text) => Math.max(0, ...meaningsOf(item).map((m) => likeness(m, text || '')));
/** The confirmed owner team of a name (null when shared or no team is configured). */
const ownerOf = (name, known, file) => teams.ownerOf(name, known, file);

/** Candidates for a new field: same object first, then the others; the type counts. */
function fieldMatches(model, item, known) {
  const out = [];
  for (const o of Object.values(model.objects || {})) {
    for (const f of Object.values(o.fields || {})) {
      const base = Math.max(best(item, f.label), best(item, f.name), f.description ? best(item, f.description) * 0.8 : 0);
      // The object and the type only help a name that already matches well (one common word is not enough).
      if (base < 0.6) continue;
      const score = base
        + (item.objeto && o.name === item.objeto ? 0.15 : 0)
        + (item.tipo_campo && f.type && String(f.type).toLowerCase() === String(item.tipo_campo).toLowerCase() ? 0.1 : 0);
      if (score >= 0.55) out.push({ ref: `${o.name}.${f.name}`, label: f.label || f.name, type: f.type, owner: ownerOf(f.name, known) || ownerOf(o.name, known), score });
    }
  }
  return out;
}

/** Candidates for a new class or method: the public methods and the class names. */
function codeMatches(model, item, known) {
  const out = [];
  for (const c of Object.values(model.classes || {})) {
    if (c.isTest || /^fflib_/i.test(c.name)) continue;
    const byClass = best(item, c.name);
    if (byClass >= 0.55) out.push({ ref: c.name, label: c.name, type: 'classe', owner: ownerOf(c.name, known, c.file), score: byClass });
    for (const s of c.signatures || []) {
      const score = Math.max(best(item, s.name), best(item, `${c.name} ${s.name}`) * 0.9);
      if (score >= 0.6) out.push({ ref: `${c.name}.${s.name}`, label: `${c.name}.${s.name}(${s.params.join(', ')})`, type: 'método', owner: ownerOf(c.name, known), score });
    }
  }
  return out;
}

/** Candidates for a new flow, object or LWC, by name and label. */
function namedMatches(entries, item, type, known) {
  return entries
    .map(([name, label]) => ({ ref: name, label: label || name, type, owner: ownerOf(name, known), score: Math.max(best(item, label), best(item, name)) }))
    .filter((c) => c.score >= 0.55);
}

/** Reuse options for each item the task wants to create. */
function reuseOptions(model, items = [], { myTeam = null, teams: confirmed = [] } = {}) {
  const known = confirmed;
  usageFacts.teams = confirmed;
  return items.map((item) => {
    const kind = String(item.tipo || item.type || '').toLowerCase();
    let found = [];
    if (/campo|field/.test(kind)) found = fieldMatches(model, item, known);
    else if (/classe|class|m[eé]todo|method|helper/.test(kind)) found = codeMatches(model, item, known);
    else if (/flow|fluxo/.test(kind)) found = namedMatches(Object.values(model.flows || {}).map((f) => [f.name, f.label]), item, 'flow', known);
    else if (/objeto|object/.test(kind)) found = namedMatches(Object.values(model.objects || {}).map((o) => [o.name, o.label]), item, 'objeto', known);
    else if (/lwc|tela|componente|component/.test(kind)) found = namedMatches(Object.keys(model.lwc || {}).map((n) => [n, n]), item, 'LWC', known);
    const candidates = found.sort((a, b) => b.score - a.score).slice(0, 3).map((c) => {
      const usage = usageFacts(model, c.ref);
      const full = { ...c, score: Math.min(1, Math.round(c.score * 100) / 100), usage };
      return { ...full, ...suggestion(full, myTeam) };
    });
    return {
      item: { tipo: item.tipo || item.type, nome: item.nome || item.name, objeto: item.objeto || null },
      candidates,
      pick: candidates.length ? candidates[0].pick : 'criar',
      why: candidates.length ? candidates[0].why : 'nada parecido no projeto: criar novo',
    };
  });
}

module.exports = { reuseOptions, usageFacts };
