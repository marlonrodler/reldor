'use strict';

const IGNORED = new Set(['Application']);

function isUsable(model, name) {
  const c = model.classes[name];
  return Boolean(c) && !c.isTest && !IGNORED.has(name) && !name.startsWith('fflib_');
}

/** Classes a class (or trigger) points to, resolving fflib interfaces to their implementation. */
function relatedClasses(model, node, selfName) {
  const refs = new Set([...(node.classRefs || []), ...(node.identifiers || [])]);
  const out = new Set();
  for (const ref of refs) {
    if (ref === selfName) continue;
    const impl = model.application.services[ref];
    if (impl && isUsable(model, impl)) out.add(impl);
    if (isUsable(model, ref) && !(model.classes[ref].kinds || []).includes('interface')) out.add(ref);
  }
  return [...out];
}

/** Breadth-first chain from a trigger (or class), up to `depth` levels. */
function chainFrom(model, node, selfName, depth = 2) {
  const seen = new Set([selfName]);
  const result = [];
  let frontier = [{ node, name: selfName }];
  for (let level = 1; level <= depth; level += 1) {
    const next = [];
    for (const { node: n, name } of frontier) {
      for (const cls of relatedClasses(model, n, name)) {
        if (seen.has(cls)) continue;
        seen.add(cls);
        const c = model.classes[cls];
        result.push({ name: cls, level, via: name, kinds: c.kinds, async: c.async || c.kinds.includes('queueable') || c.kinds.includes('batch') });
        next.push({ node: c, name: cls });
      }
    }
    frontier = next;
  }
  return result;
}

/** Custom settings / custom metadata referenced by a set of classes: likely bypass switches. */
function bypassSwitches(model, classNames) {
  const switches = new Set();
  for (const name of classNames) {
    const c = model.classes[name];
    if (!c) continue;
    for (const id of [...c.identifiers, ...c.fieldRefs.map((r) => r.split('.')[0])]) {
      const o = model.objects[id];
      if (o && (o.customSetting || o.customMetadata)) switches.add(id);
    }
  }
  return [...switches];
}

/** Test classes that touch an object or any of the given classes. */
function relatedTests(model, object, classNames) {
  const names = new Set(classNames);
  return Object.values(model.classes)
    .filter((c) => c.isTest)
    .filter((c) => c.dml.some((d) => d.type === object) || c.soql.some((q) => q.object === object) || c.identifiers.some((id) => names.has(id) || id === object))
    .map((c) => c.name);
}

module.exports = { relatedClasses, chainFrom, bypassSwitches, relatedTests };
