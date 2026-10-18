'use strict';

const IGNORED = new Set(['Application']);

/** Trigger-phase method names per framework, for one timing + event. */
function phaseMethods(timing, event) {
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const fflib = {
    'before insert': ['onApplyDefaults/0', 'onBeforeInsert/0'],
    'before update': ['onBeforeUpdate/1'],
    'before delete': ['onBeforeDelete/0'],
    'after insert': ['onValidate/0', 'onAfterInsert/0'],
    'after update': ['onValidate/1', 'onAfterUpdate/1'],
    'after delete': ['onAfterDelete/0'],
    'after undelete': ['onAfterUndelete/0'],
  }[`${timing} ${event}`] || [];
  return [...fflib, `${timing}${cap(event)}/0`];
}

function isUsable(model, name) {
  const c = model.classes[name];
  return Boolean(c) && !c.isTest && !IGNORED.has(name) && !name.startsWith('fflib_');
}

/** Identifiers a class uses. For trigger handlers in a known phase, only the methods of that phase count. */
function refsOf(node, phase) {
  if (phase && node.handlerRefs) {
    const keys = phaseMethods(phase.timing, phase.event);
    const used = keys.filter((k) => node.handlerRefs[k] || node.handlerRefs[k.replace(/\/\d+$/, '/0')]);
    if (!used.length) return { idle: true, refs: [] };
    return { idle: false, refs: used.flatMap((k) => node.handlerRefs[k] || node.handlerRefs[k.replace(/\/\d+$/, '/0')]) };
  }
  return { idle: false, refs: [...(node.classRefs || []), ...(node.identifiers || [])] };
}

/**
 * Classes referenced by custom metadata records of a __mdt type the code reads (metadata-driven triggers).
 * When a record also names the object, only records for that object count.
 */
function dynamicClasses(model, node, object) {
  const out = [];
  for (const id of node.identifiers || []) {
    const records = model.customMetadata[id];
    if (!records) continue;
    for (const r of records) {
      const values = Object.values(r.values).map(String);
      const mentionsObject = values.some((v) => model.objects[v]);
      if (object && mentionsObject && !values.includes(object)) continue;
      const enabled = Object.entries(r.values).find(([k]) => /enabled|active|ativo/i.test(k));
      if (enabled && String(enabled[1]) === 'false') continue;
      for (const v of values) if (isUsable(model, v)) out.push({ name: v, via: `${id} (${r.name})` });
    }
  }
  return out;
}

/** Classes a node points to, resolving fflib interfaces to their implementation. */
function relatedClasses(model, node, selfName, phase, object) {
  const { idle, refs } = refsOf(node, phase);
  if (idle) return { idle, classes: [] };
  const out = new Map();
  for (const ref of new Set(refs)) {
    if (ref === selfName || ref === node.extendsName) continue;
    const impl = model.application.services[ref];
    if (impl && isUsable(model, impl)) out.set(impl, { name: impl });
    if (isUsable(model, ref) && !(model.classes[ref].kinds || []).includes('interface')) out.set(ref, { name: ref });
  }
  for (const d of dynamicClasses(model, node, object)) if (!out.has(d.name)) out.set(d.name, { name: d.name, dynamicVia: d.via });
  return { idle: false, classes: [...out.values()] };
}

/**
 * Breadth-first chain from a trigger (or class), up to `depth` levels.
 * With `phase` ({ timing, event }), trigger handlers only follow the methods of that phase and
 * handlers with no logic for the phase are left out.
 */
function chainFrom(model, node, selfName, depth = 3, phase = null, object = null) {
  const seen = new Set([selfName]);
  const result = [];
  let frontier = [{ node, name: selfName }];
  for (let level = 1; level <= depth; level += 1) {
    const next = [];
    for (const { node: n, name } of frontier) {
      for (const ref of relatedClasses(model, n, name, null, object).classes) {
        if (seen.has(ref.name)) continue;
        const c = model.classes[ref.name];
        const { idle } = refsOf(c, phase);
        if (phase && idle) {
          seen.add(ref.name);
          continue;
        }
        seen.add(ref.name);
        result.push({
          name: ref.name,
          level,
          via: ref.dynamicVia || name,
          dynamic: Boolean(ref.dynamicVia),
          kinds: c.kinds,
          async: c.async || c.kinds.includes('queueable') || c.kinds.includes('batch'),
        });
        next.push({ node: phase && c.handlerRefs ? { ...c, ...phaseView(c, phase) } : c, name: ref.name });
      }
    }
    frontier = next;
  }
  const bases = new Set(result.map((r) => model.classes[r.name]?.extendsName).filter(Boolean));
  return result.filter((r) => !bases.has(r.name));
}

/** A handler seen only through its methods for one phase. */
function phaseView(cls, phase) {
  const { refs } = refsOf(cls, phase);
  return { classRefs: [], identifiers: refs, handlerRefs: undefined };
}

/** Custom settings / custom metadata referenced by a set of classes: likely bypass switches. */
function bypassSwitches(model, classNames) {
  const switches = new Set();
  for (const name of classNames) {
    const c = model.classes[name];
    if (!c) continue;
    for (const id of [...c.identifiers, ...c.fieldRefs.map((r) => r.split('.')[0])]) {
      const o = model.objects[id];
      if ((o && (o.customSetting || o.customMetadata)) || (/__mdt$/.test(id) && !model.customMetadata[id])) switches.add(id);
    }
  }
  return [...switches];
}

/** Tests that use the chain directly, and tests that only create or change the object. */
function relatedTests(model, object, classNames) {
  const names = new Set(classNames);
  const direct = [];
  const byObject = [];
  for (const c of Object.values(model.classes)) {
    if (!c.isTest || c.hasTestMethods === false) continue; // helpers such as a data factory are not tests
    if (c.identifiers.some((id) => names.has(id))) direct.push(c.name);
    else if (c.dml.some((d) => d.type && object && d.type.toLowerCase() === object.toLowerCase())) byObject.push(c.name);
  }
  return { direct, byObject };
}

module.exports = { relatedClasses, chainFrom, bypassSwitches, relatedTests, phaseMethods, dynamicClasses };
