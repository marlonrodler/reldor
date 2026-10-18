'use strict';

/**
 * Test radar: from the files a feature changed, which Apex tests can break and why.
 * Everything is computed from the index; nothing runs in the org here.
 */

const { chainFrom } = require('../indexer/query');

const OBJECT_TYPES = new Set(['field', 'validationRule', 'recordType', 'object', 'duplicateRule', 'workflow', 'layout', 'listView', 'compactLayout']);

/** Classes that point to `name` (directly or through an fflib interface). */
function referencedBy(model, name) {
  const iface = Object.entries(model.application.services).find(([, impl]) => impl === name)?.[0];
  const aliases = new Set([name, iface].filter(Boolean));
  return Object.values(model.classes).filter((c) => c.name !== name && (c.identifiers.some((id) => aliases.has(id)) || c.classRefs.some((id) => aliases.has(id))));
}

/** Test helper classes (factories) that create records of an object. Kept for callers; the radar uses methods. */
function factoriesFor(model, object) {
  return [...new Set([...creatorMethods(model, object)].map((k) => k.split('.')[0]))];
}

/**
 * "Class.method" of every method that saves records of `object` (kind "saves": insert/update/upsert) or builds them
 * in memory (kind "builds": new X(...)), directly or by calling another such method (factory chains, any depth).
 */
function creatorMethods(model, object, kind = 'saves') {
  const cacheKey = `${kind}|${String(object).toLowerCase()}`;
  model._creators = model._creators || new Map();
  if (model._creators.has(cacheKey)) return model._creators.get(cacheKey);
  const set = new Set();
  const lower = new Set(); // Apex names are case-insensitive: "Fabrica.Conta(" calls "fabrica.conta"
  const add = (key) => {
    set.add(key);
    lower.add(key.toLowerCase());
  };
  const classes = Object.values(model.classes);
  for (const c of classes) {
    const own = kind === 'saves' ? c.methodSaves || legacySaves(c) : c.methodBuilds || c.methodCreates || {};
    for (const [m, types] of Object.entries(own)) if (types.some((t) => sameName(t, object))) add(`${c.name}.${m}`);
  }
  for (let round = 0; round < 12; round++) {
    let grew = false;
    for (const c of classes) {
      for (const [m, calls] of Object.entries(c.methodCalls || {})) {
        const key = `${c.name}.${m}`;
        if (lower.has(key.toLowerCase())) continue;
        if (calls.some((x) => lower.has((x.includes('.') ? x : `${c.name}.${x}`).toLowerCase()))) {
          add(key);
          grew = true;
        }
      }
    }
    if (!grew) break;
  }
  set.hasName = (k) => lower.has(String(k).toLowerCase());
  model._creators.set(cacheKey, set);
  return set;
}

/** Older indexes have methodCreates only: everything created counted as saved. */
function legacySaves(c) {
  return c.methodCreates || {};
}

/**
 * Objects whose save also saves `object`: a trigger or flow of A that inserts or updates `object`, or a roll-up
 * summary from A into `object`. Followed a few levels (A saves B, B's trigger saves `object`).
 * Returns Map(objectA -> reason).
 */
function savedThrough(model, object) {
  model._savedThrough = model._savedThrough || new Map();
  const key = String(object).toLowerCase();
  if (model._savedThrough.has(key)) return model._savedThrough.get(key);
  // Custom settings, custom metadata and platform events have no validation rules, record types or record saves
  // a test could trip through another object: no cascade for them.
  const o = Object.entries(model.objects).find(([n]) => n.toLowerCase() === key)?.[1];
  if ((o && (o.customSetting || o.customMetadata)) || /__(mdt|e)$/i.test(object)) {
    model._savedThrough.set(key, new Map());
    return model._savedThrough.get(key);
  }
  const direct = (target) => {
    const out = new Map();
    for (const t of Object.values(model.triggers)) {
      if (!t.object || sameName(t.object, target)) continue;
      const chain = chainFrom(model, t, `trigger:${t.name}`, 4, null, t.object);
      const writer = [t, ...chain.map((x) => model.classes[x.name])].find((c) => c && (c.dml || []).some((d) => sameName(d.type, target) && !/^(delete|undelete)$/i.test(d.op || '')));
      if (writer) out.set(t.object, `a trigger ${t.name} de ${t.object} grava ${target}${writer.name && writer !== t ? ` (em ${writer.name})` : ''}`);
    }
    for (const f of Object.values(model.flows)) {
      if (!f.object || !f.timing || f.active === false || sameName(f.object, target)) continue;
      if ([...(f.creates || []), ...(f.updates || [])].some((o) => sameName(o, target))) out.set(f.object, `o flow ${f.name} de ${f.object} grava ${target}`);
    }
    for (const o of Object.values(model.objects)) {
      for (const r of o.rollupsTo || []) if (sameName(r.parent, target) && !out.has(o.name)) out.set(o.name, `o roll-up ${target}.${r.field} recalcula ao salvar ${o.name}`);
    }
    return out;
  };
  const result = new Map();
  let frontier = [[object, null]];
  for (let level = 0; level < 3 && frontier.length; level++) {
    const next = [];
    for (const [target, via] of frontier) {
      for (const [a, why] of direct(target)) {
        if (sameName(a, object) || result.has(a)) continue;
        const reason = via ? `${why}; ${via}` : why;
        result.set(a, reason);
        next.push([a, reason]);
      }
    }
    frontier = next;
  }
  model._savedThrough.set(key, result);
  return result;
}

/** Apex and metadata names compare without case (npe01__Contacts_and_Orgs_Settings__c is the same object). */
const sameName = (a, b) => Boolean(a && b) && a.toLowerCase() === b.toLowerCase();

/** True for a class that runs as a test (has test methods). Old indexes without the flag fall back to isTest. */
const runsAsTest = (c) => Boolean(c && c.isTest && c.hasTestMethods !== false);

/** What each changed file means for tests: objects whose save behaviour changed, classes whose code changed. */
function impactsOf(model, changes) {
  const objects = new Map();
  const classes = new Map();
  const notes = [];
  const fieldChanges = [];
  const recordTypeChanges = [];
  const addObject = (object, why) => {
    if (!object) return;
    if (!objects.has(object)) objects.set(object, []);
    objects.get(object).push(why);
  };

  for (const c of changes) {
    const m = c.meta;
    const label = `(${c.status === 'added' ? 'novo' : c.status === 'deleted' ? 'removido' : 'alterado'})`;
    if (m.type === 'field') {
      const field = model.objects[m.object]?.fields[m.name];
      const extra = field ? [field.required && 'obrigatório', field.unique && 'único', field.type].filter(Boolean).join(', ') : '';
      addObject(m.object, `campo ${m.object}.${m.name}${extra ? ` [${extra}]` : ''} ${label}`);
      fieldChanges.push({ object: m.object, field: m.name, why: `campo ${m.object}.${m.name} ${label}`, strict: Boolean(field && (field.required || field.unique)) || c.status === 'added' });
    } else if (m.type === 'validationRule') addObject(m.object, `validation rule ${m.name} ${label}`);
    else if (m.type === 'recordType') {
      addObject(m.object, `record type ${m.name} ${label}`);
      recordTypeChanges.push({ object: m.object, name: m.name, why: `record type ${m.name} ${label}` });
    }
    else if (m.type === 'duplicateRule') addObject(m.object, `regra de duplicidade ${m.name} ${label}`);
    else if (m.type === 'workflow') addObject(m.object, `workflow ${label}`);
    else if (m.type === 'trigger') {
      const t = model.triggers[m.name];
      addObject(t?.object, `trigger ${m.name} ${label}`);
    } else if (m.type === 'flow') {
      const f = model.flows[m.name];
      if (f?.object && f.timing) addObject(f.object, `flow ${m.name} ${label}`);
      else if (f) for (const cls of f.apexActions) classes.set(cls, `chamada pelo flow ${m.name}`);
    } else if (m.type === 'class') {
      classes.set(m.name, `classe ${m.name} ${label}`);
    } else if (m.type === 'permission') {
      const p = model.permissions.find((x) => x.name === m.name);
      const objs = new Set((p?.fields || []).map((f) => f.split('.')[0]));
      for (const o of objs) addObject(o, `permissão ${m.name} ${label}`);
      if (!objs.size) notes.push(`Permissão ${m.name} ${label}: confira testes com System.runAs.`);
    } else if (m.type === 'customMetadataRecord') {
      for (const c2 of Object.values(model.classes)) if (!c2.isTest && c2.identifiers.includes(m.object)) classes.set(c2.name, `lê ${m.object} (registro ${m.name} ${label})`);
    } else if (m.type === 'lwcJs' || m.type === 'lwcHtml') {
      notes.push(`LWC ${m.name} ${label}: não há teste Apex para tela; rode os testes Jest do componente.`);
    }
  }
  return { objects, classes, notes, fieldChanges, recordTypeChanges };
}

/** Builds the radar. Returns tests ranked by priority, each with its reasons. */
function buildRadar(model, changes) {
  const { objects, classes, notes, fieldChanges, recordTypeChanges } = impactsOf(model, changes);
  const tests = new Map();
  const hit = (name, priority, reason) => {
    const c = model.classes[name];
    if (!runsAsTest(c)) return;
    const t = tests.get(name) || { name, priority: 'média', reasons: [] };
    if (priority === 'alta') t.priority = 'alta';
    if (!t.reasons.includes(reason)) t.reasons.push(reason);
    tests.set(name, t);
  };

  for (const [cls, why] of classes) {
    for (const user of referencedBy(model, cls)) {
      if (user.isTest) hit(user.name, 'alta', `usa ${cls} (${why})`);
      else if (!user.kinds.includes('application')) {
        for (const second of referencedBy(model, user.name)) if (second.isTest) hit(second.name, 'média', `usa ${user.name}, que usa ${cls}`);
      }
    }
    // Classes loaded by name (Type.forName, handler tables in custom settings or metadata)
    for (const c of Object.values(model.classes)) {
      if (runsAsTest(c) && c.name !== cls && (c.strings || []).some((x) => x.toLowerCase() === cls.toLowerCase())) hit(c.name, 'alta', `cita ${cls} pelo nome (${why})`);
    }
    for (const t of Object.values(model.triggers)) {
      if (t.object && objects.has(t.object)) continue;
      if (chainFrom(model, t, `trigger:${t.name}`, 3, null, t.object).some((c) => c.name === cls)) {
        addVia(t.object, `${cls} roda na trigger ${t.name}`);
      }
    }
  }

  function addVia(object, why) {
    for (const c of Object.values(model.classes)) if (runsAsTest(c) && c.dml.some((d) => sameName(d.type, object))) hit(c.name, 'média', `cria ou altera ${object} (${why})`);
  }

  for (const [object, whys] of objects) {
    const why = whys.join('; ');
    const automation = whys.some((w) => /^(trigger|flow|workflow)/.test(w));
    const savesDml = (d) => sameName(d.type, object) && (automation || !/^(delete|undelete)$/i.test(d.op || ''));
    const savers = creatorMethods(model, object, 'saves');
    const builders = creatorMethods(model, object, 'builds');
    // A field change only breaks a save when the field is required or unique; otherwise the code that uses it is
    // what breaks (see fieldChanges below), and tests that save the object are a medium-priority safety net.
    const onlyFields = whys.every((w) => w.startsWith('campo '));
    const strictField = onlyFields && fieldChanges.some((f) => sameName(f.object, object) && f.strict);
    const savePriority = onlyFields && !strictField ? 'média' : 'alta';
    const through = onlyFields && !strictField ? new Map() : savedThrough(model, object);
    const throughSavers = [...through.keys()].map((a) => [a, creatorMethods(model, a, 'saves')]);
    for (const c of Object.values(model.classes)) {
      if (!runsAsTest(c)) continue;
      const own = (k) => k.toLowerCase().startsWith(`${c.name.toLowerCase()}.`);
      const saves = (c.dml || []).some(savesDml);
      // A factory call first: a test method that calls a factory is itself in `savers`, but it saves through it.
      const via = saves ? null : (c.calls || []).find((k) => savers.hasName(k) && !own(k));
      if (saves) {
        hit(c.name, savePriority, `cria ou altera ${object} (${why})`);
        continue;
      }
      if (via) {
        hit(c.name, savePriority, `cria ${object} pela factory ${via} (${why})`);
        continue;
      }
      // Saving another object whose trigger, flow or roll-up saves this one.
      let cascade = null;
      for (const [a, aSavers] of throughSavers) {
        const direct = (c.dml || []).some((d) => sameName(d.type, a) && !/^(delete|undelete)$/i.test(d.op || ''));
        const viaA = direct ? null : (c.calls || []).find((k) => aSavers.hasName(k) && !own(k));
        if (direct || viaA) {
          cascade = `salva ${a}${viaA ? ` (pela factory ${viaA})` : ''}, e ${through.get(a)} (${why})`;
          break;
        }
      }
      if (cascade) {
        // The other object's automation saves this one, often only on some paths (an error log, a default setting).
        hit(c.name, 'média', cascade);
        continue;
      }
      const builds = Object.values(c.methodBuilds || c.methodCreates || {}).some((types) => types.some((t) => sameName(t, object))) || (c.calls || []).some((k) => builders.hasName(k) && !own(k));
      if (builds) hit(c.name, 'média', `monta registros de ${object} no teste, sem salvar (${why})`);
      else if (c.runAs && whys.some((w) => w.startsWith('permissão')) && c.identifiers.includes(object)) hit(c.name, 'média', `usa System.runAs com ${object} (${why})`);
    }
    for (const r of model.objects[object]?.rollupsTo || []) notes.push(`${object} faz roll-up em ${r.parent}: as automações de ${r.parent} também rodam.`);
  }

  // A changed field: tests that use it in code break when it is renamed, removed or changes type.
  for (const fc of fieldChanges) {
    const { resolveFieldRef } = require('../checks/fieldresolve');
    for (const c of Object.values(model.classes)) {
      const uses = (c.fieldUses || []).some((r) => sameName(r.field, fc.field) && sameName(resolveFieldRef(model, r).object, fc.object));
      if (!uses) continue;
      if (runsAsTest(c)) hit(c.name, 'alta', `usa o campo ${fc.object}.${fc.field} (${fc.why})`);
      else if (!c.isTest) for (const user of referencedBy(model, c.name)) if (runsAsTest(user)) hit(user.name, 'média', `usa ${c.name}, que usa o campo ${fc.object}.${fc.field} (${fc.why})`);
    }
  }
  // A changed record type: tests that look it up by name.
  for (const rc of recordTypeChanges) {
    for (const c of Object.values(model.classes)) {
      if (runsAsTest(c) && (c.strings || []).some((x) => x.toLowerCase() === rc.name.toLowerCase())) hit(c.name, 'alta', `usa o record type ${rc.name} pelo nome (${rc.why})`);
    }
  }

  const order = { alta: 0, 'média': 1 };
  return {
    changes: changes.map((c) => ({ file: c.file, status: c.status, type: c.meta.type })),
    objects: [...objects.keys()],
    classes: [...classes.keys()],
    tests: [...tests.values()].sort((a, b) => order[a.priority] - order[b.priority] || a.name.localeCompare(b.name)),
    notes: [...new Set(notes)],
  };
}

module.exports = { buildRadar, impactsOf, referencedBy, factoriesFor, creatorMethods, savedThrough, runsAsTest, OBJECT_TYPES };
