'use strict';

/**
 * Limits counted from the project (no org): custom fields, relationship fields, master-detail, roll-ups and active
 * validation rules per object, values per picklist, formula size. The edition decides some of them (`org.edition` in
 * the config; Enterprise by default). What is in the project is a floor: the org can have more than was retrieved.
 * Allocations from Salesforce Help ("Custom Fields Allowed Per Object" and the limits quick reference); fields of
 * managed packages (ns__Field__c) have their own allowance and are not counted.
 */

const EDITIONS = {
  professional: { fields: 100, validationRules: 20 },
  enterprise: { fields: 500, validationRules: 100 },
  developer: { fields: 500, validationRules: 100 },
  unlimited: { fields: 800, validationRules: 500 },
  performance: { fields: 800, validationRules: 500 },
};
const FIXED = { relationships: 40, masterDetail: 2, rollups: 25, picklistValues: 1000, multiPicklistValues: 500, standardPicklistValues: 100, formulaChars: 3900 };
const WARN = 0.8;

const isManaged = (name) => /^[A-Za-z0-9]+__\w+__c$/.test(name);

/** The counts of one object, from the index model. */
function objectCounts(o) {
  const fields = Object.values(o.fields || {}).filter((f) => /__c$/i.test(f.name) && !isManaged(f.name));
  const type = (t) => fields.filter((f) => String(f.type || '').toLowerCase() === t).length;
  return {
    fields: fields.length,
    relationships: type('lookup') + type('masterdetail') + type('hierarchy'),
    masterDetail: type('masterdetail'),
    rollups: type('summary'),
    validationRules: (o.validationRules || []).filter((v) => v.active).length,
  };
}

/** Limit lines (used / limit) for each object, with the ones at 80% or more marked. */
function limitsReport(model, config = {}, { objects = null } = {}) {
  const edition = String(config.org?.edition || 'enterprise').toLowerCase();
  const ed = EDITIONS[edition] || EDITIONS.enterprise;
  const out = [];
  for (const o of Object.values(model.objects || {})) {
    if (objects && !objects.includes(o.name)) continue;
    const c = objectCounts(o);
    const checks = [
      ['campos customizados', c.fields, ed.fields],
      ['campos de relacionamento (lookup e master-detail)', c.relationships, FIXED.relationships],
      ['master-detail', c.masterDetail, FIXED.masterDetail],
      ['roll-ups', c.rollups, FIXED.rollups],
      ['validation rules ativas', c.validationRules, ed.validationRules],
    ];
    for (const [what, used, limit] of checks) {
      if (!used) continue;
      out.push({ object: o.name, what, used, limit, pct: Math.round((used / limit) * 100), near: used / limit >= WARN });
    }
    for (const f of Object.values(o.fields || {})) {
      if (f.picklist) {
        const multi = /multiselect/i.test(f.type || '');
        const limit = /__c$/i.test(f.name) ? (multi ? FIXED.multiPicklistValues : FIXED.picklistValues) : FIXED.standardPicklistValues;
        if (f.picklist.length / limit >= WARN) out.push({ object: o.name, what: `valores da picklist ${f.name}`, used: f.picklist.length, limit, pct: Math.round((f.picklist.length / limit) * 100), near: true });
      }
      if (f.formula && f.formula.length / FIXED.formulaChars >= WARN) out.push({ object: o.name, what: `tamanho da fórmula ${f.name} (caracteres)`, used: f.formula.length, limit: FIXED.formulaChars, pct: Math.round((f.formula.length / FIXED.formulaChars) * 100), near: true });
    }
  }
  return { edition: EDITIONS[edition] ? edition : 'enterprise', items: out.sort((a, b) => b.pct - a.pct) };
}

/** For a task that creates fields: how each object ends up, said only when it gets close to a limit. */
function limitsForTask(model, createItems = [], config = {}) {
  const byObject = new Map();
  for (const item of createItems) {
    if (!/campo|field/i.test(String(item.tipo || item.type || '')) || !item.objeto) continue;
    const t = String(item.tipo_campo || '').toLowerCase();
    const add = byObject.get(item.objeto) || { fields: 0, relationships: 0, rollups: 0, masterDetail: 0 };
    add.fields += 1;
    if (/lookup|master/.test(t)) add.relationships += 1;
    if (/master/.test(t)) add.masterDetail += 1;
    if (/summary|roll/.test(t)) add.rollups += 1;
    byObject.set(item.objeto, add);
  }
  const edition = String(config.org?.edition || 'enterprise').toLowerCase();
  const ed = EDITIONS[edition] || EDITIONS.enterprise;
  const out = [];
  for (const [object, add] of byObject) {
    const o = model.objects[object];
    const c = o ? objectCounts(o) : { fields: 0, relationships: 0, masterDetail: 0, rollups: 0 };
    for (const [key, what, limit] of [['fields', 'campos customizados', ed.fields], ['relationships', 'campos de relacionamento', FIXED.relationships], ['masterDetail', 'master-detail', FIXED.masterDetail], ['rollups', 'roll-ups', FIXED.rollups]]) {
      if (!add[key]) continue;
      const after = c[key] + add[key];
      if (after / limit < WARN) continue;
      out.push({ object, what, before: c[key], after, limit, text: `${object}: com a task, ${what} vão de ${c[key]} para ${after} de ${limit} (${Math.round((after / limit) * 100)}%)${after > limit ? ': passa do limite' : ''}. Conta pelo projeto; a org pode ter mais. Antes de criar, veja se dá para reusar.` });
    }
  }
  return out;
}

/**
 * Org limits that only the org knows (API calls, storage...), from `sf org list limits --json`: a read-only command,
 * so it runs directly. Returns the ones at 80% or more.
 */
function orgLimits(root, org) {
  const { runSf, parseJson } = require('./org/sf');
  const res = runSf(['org', 'list', 'limits', '--json', '--target-org', org], { cwd: root, timeout: 120000 });
  const json = parseJson(res.stdout);
  if (!json || json.status !== 0) return { ok: false, error: (json && json.message) || res.stderr || 'sem resposta do sf CLI' };
  const items = (json.result || [])
    .map((l) => ({ name: l.name, used: l.max - l.remaining, limit: l.max, pct: l.max ? Math.round(((l.max - l.remaining) / l.max) * 100) : 0 }))
    .filter((l) => l.limit > 0);
  return { ok: true, near: items.filter((l) => l.pct >= WARN * 100).sort((a, b) => b.pct - a.pct), total: items.length };
}

module.exports = { limitsReport, limitsForTask, orgLimits, objectCounts, EDITIONS, FIXED };
