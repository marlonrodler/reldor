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

/** Test helper classes (factories) that create records of an object. */
function factoriesFor(model, object) {
  return Object.values(model.classes)
    .filter((c) => (c.isTest || /factory|testdata|testutil|datafactory/i.test(c.name)) && c.dml.some((d) => d.type === object))
    .map((c) => c.name);
}

/** What each changed file means for tests: objects whose save behaviour changed, classes whose code changed. */
function impactsOf(model, changes) {
  const objects = new Map();
  const classes = new Map();
  const notes = [];
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
    } else if (m.type === 'validationRule') addObject(m.object, `validation rule ${m.name} ${label}`);
    else if (m.type === 'recordType') addObject(m.object, `record type ${m.name} ${label}`);
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
  return { objects, classes, notes };
}

/** Builds the radar. Returns tests ranked by priority, each with its reasons. */
function buildRadar(model, changes) {
  const { objects, classes, notes } = impactsOf(model, changes);
  const tests = new Map();
  const hit = (name, priority, reason) => {
    const c = model.classes[name];
    if (!c || !c.isTest) return;
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
    for (const t of Object.values(model.triggers)) {
      if (t.object && objects.has(t.object)) continue;
      if (chainFrom(model, t, `trigger:${t.name}`, 3, null, t.object).some((c) => c.name === cls)) {
        addVia(t.object, `${cls} roda na trigger ${t.name}`);
      }
    }
  }

  function addVia(object, why) {
    for (const c of Object.values(model.classes)) if (c.isTest && c.dml.some((d) => d.type === object)) hit(c.name, 'média', `cria ou altera ${object} (${why})`);
  }

  for (const [object, whys] of objects) {
    const why = whys.join('; ');
    const factories = factoriesFor(model, object);
    for (const c of Object.values(model.classes)) {
      if (!c.isTest) continue;
      if (c.dml.some((d) => d.type === object)) hit(c.name, 'alta', `cria ou altera ${object} (${why})`);
      else if (factories.some((f) => f !== c.name && c.identifiers.includes(f))) hit(c.name, 'alta', `cria ${object} pela factory (${why})`);
      else if (c.runAs && whys.some((w) => w.startsWith('permissão')) && c.identifiers.includes(object)) hit(c.name, 'média', `usa System.runAs com ${object} (${why})`);
    }
    for (const r of model.objects[object]?.rollupsTo || []) notes.push(`${object} faz roll-up em ${r.parent}: as automações de ${r.parent} também rodam.`);
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

module.exports = { buildRadar, impactsOf, referencedBy, factoriesFor, OBJECT_TYPES };
