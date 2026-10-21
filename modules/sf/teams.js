'use strict';

/**
 * Who owns what, by name: the prefixes the project uses on classes, objects and fields (VND_PedidoService,
 * VND_Pedido__c, VND_Valor__c) become "teams"; what has no team prefix is shared. Also the catalog of shared public
 * methods (`reldor helpers`) and the methods that look the same across teams (candidates for one generic method).
 * Everything comes from the project index: no AI, no org.
 */

const FRAMEWORK_PREFIXES = new Set(['fflib', 'test', 'tst', 'mock', 'util', 'utils']);
const SHARED_NAME = /(Util|Utils|Helper|Helpers|Utility|Utilities|Common|Commons|Shared|Core|Base|Generic|Factory)$/i;

/** The team prefix of a name: "VND" in VND_PedidoService or VND_Pedido__c. A namespace (ns__Field__c) is not a prefix. */
function prefixOf(name) {
  if (!name || /^[A-Za-z0-9]+__\w+__[a-z]+$/i.test(name)) return null;
  const m = String(name).match(/^([A-Za-z][A-Za-z0-9]{1,7})_(?!_)[A-Za-z0-9]/);
  if (!m || FRAMEWORK_PREFIXES.has(m[1].toLowerCase())) return null;
  return m[1];
}

/** Prefixes used by at least `min` items (classes, objects and custom fields together), biggest first. */
function teamPrefixes(model, { min = 3, known = [] } = {}) {
  const items = new Map();
  const add = (prefix, kind, name) => {
    if (!prefix) return;
    const key = prefix.toUpperCase();
    const t = items.get(key) || items.set(key, { prefix: key, spelling: prefix, classes: [], objects: [], fields: [] }).get(key);
    t[kind].push(name);
  };
  for (const c of Object.values(model.classes || {})) if (!c.isTest) add(prefixOf(c.name), 'classes', c.name);
  for (const o of Object.values(model.objects || {})) {
    if (/__c$/i.test(o.name)) add(prefixOf(o.name), 'objects', o.name);
    for (const f of Object.keys(o.fields || {})) if (/__c$/i.test(f)) add(prefixOf(f), 'fields', `${o.name}.${f}`);
  }
  const knownSet = new Set(known.map((k) => String(k).toUpperCase()));
  // A team prefix is written in capitals somewhere (VND_, RD2_); "Payment_Method__c" is just a word of the name.
  const upper = new Set();
  for (const c of Object.values(model.classes || {})) {
    const p = prefixOf(c.name);
    if (p && p === p.toUpperCase()) upper.add(p);
  }
  for (const o of Object.values(model.objects || {})) {
    for (const n of [o.name, ...Object.keys(o.fields || {})]) {
      const p = prefixOf(n);
      if (p && p === p.toUpperCase() && p.length <= 6) upper.add(p);
    }
  }
  return [...items.values()]
    .filter((t) => knownSet.has(t.prefix) || (upper.has(t.prefix) && t.classes.length + t.objects.length + t.fields.length >= min))
    .sort((a, b) => b.classes.length + b.objects.length + b.fields.length - (a.classes.length + a.objects.length + a.fields.length));
}

/** Words of a method name, for matching: buscarContasAtivas -> buscar, contas, ativas. */
function words(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\W]+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

/** Which team a class belongs to (its prefix, if it is a team prefix), or null for shared code. */
function ownerOf(className, teams) {
  const p = prefixOf(className);
  return p && teams.some((t) => t.prefix === p.toUpperCase()) ? p.toUpperCase() : null;
}

/** Public methods of non-test classes, with owner (team or shared). */
function catalog(model, teams) {
  const out = [];
  for (const c of Object.values(model.classes || {})) {
    if (c.isTest || /^fflib_/i.test(c.name) || (c.kinds || []).includes('interface')) continue;
    const owner = ownerOf(c.name, teams);
    const shared = !owner;
    for (const s of c.signatures || []) {
      if (/^(execute|start|finish|getSObjectType|getSObjectFieldList|construct|on[A-Z]\w*|before\w+|after\w+|handle\w*)$/.test(s.name)) continue;
      out.push({ className: c.name, method: s.name, params: s.params, returns: s.returns, static: s.static, owner, shared, helperClass: SHARED_NAME.test(c.name.replace(/^[A-Za-z0-9]+_/, '')), file: c.file, line: s.line });
    }
  }
  return out;
}

/** Search the catalog: every word of the term must appear in the method name, the class name or a parameter. */
function searchHelpers(model, term, { teams } = {}) {
  const list = catalog(model, teams || teamPrefixes(model));
  const want = words(term || '');
  const hits = list.filter((h) => {
    if (!want.length) return h.shared;
    const hay = new Set([...words(h.method), ...words(h.className), ...h.params.flatMap((p) => words(p))]);
    return want.every((w) => [...hay].some((x) => x === w || (w.length >= 3 && x.startsWith(w)) || (x.length >= 5 && w.startsWith(x))));
  });
  // Shared and helper classes first: they are the ones meant to be reused.
  return hits.sort((a, b) => Number(b.shared) - Number(a.shared) || Number(b.helperClass) - Number(a.helperClass) || a.className.localeCompare(b.className)).slice(0, 50);
}

/**
 * Methods with the same name words (ignoring the team prefix) in classes of different owners: two teams wrote the same
 * thing. Each group is a candidate for one generic method in shared code.
 */
function similarAcrossTeams(model, { teams } = {}) {
  const list = catalog(model, teams || teamPrefixes(model));
  const classes = model.classes || {};
  // Classes that share a contract (same base class or interface) repeat method names on purpose: not duplication.
  const contracts = (name) => {
    const c = classes[name] || {};
    return new Set([c.extendsName, ...(c.implementsNames || [])].filter(Boolean));
  };
  const groups = new Map();
  for (const h of list) {
    const w = words(h.method);
    if (w.length < 2) continue;
    const key = [...w].sort().join(' ');
    (groups.get(key) || groups.set(key, []).get(key)).push(h);
  }
  return [...groups.values()]
    .map((g) => {
      // Drop members that inherit the method from a class in the group, and members sharing a contract with another.
      const names = new Set(g.map((h) => h.className));
      return g.filter((h) => {
        const mine = contracts(h.className);
        if ([...mine].some((b) => names.has(b))) return false;
        return !g.some((o) => o.className !== h.className && [...contracts(o.className)].some((b) => mine.has(b)));
      });
    })
    .filter((g) => new Set(g.map((h) => h.owner || 'compartilhado')).size >= 2 && new Set(g.map((h) => h.className)).size >= 2)
    .map((g) => ({ method: g[0].method, owners: [...new Set(g.map((h) => h.owner || 'compartilhado'))], where: [...new Set(g.map((h) => `${h.className}.${h.method}(${h.params.join(', ')})`))] }))
    .slice(0, 30);
}

module.exports = { prefixOf, teamPrefixes, ownerOf, catalog, searchHelpers, similarAcrossTeams, words };
