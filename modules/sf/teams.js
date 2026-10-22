'use strict';

/**
 * Teams, only when confirmed. Each company marks a team in its own way (at the start, middle or end of a name, with or
 * without a separator, by folder...), so the Reldor never decides an owner by guessing: it suggests words that repeat
 * in many names, and only the teams saved in the config (`teams:`, `reldor teams add`) say who owns what.
 * Also the catalog of public methods (`reldor helpers`) and the methods that look the same in different classes.
 * Everything comes from the project index: no AI, no org.
 */

const SHARED_NAME = /(Util|Utils|Helper|Helpers|Utility|Utilities|Common|Commons|Shared|Core|Base|Generic|Factory)$/i;

/** The words of a name: VND_PedidoService, OpportunityVendasService, vnd-tela, VNDPedido__c → lower-case words. */
function nameTokens(name) {
  return String(name || '')
    .replace(/^[A-Za-z0-9]+__(?=\w+__)/, '') // namespace
    .replace(/__(c|mdt|e|r|x|b)$/i, '')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/**
 * Compiles the confirmed teams: { name, match, where: start|end|anywhere } (a word of the name), { name, regex }
 * or { name, folder } (a part of the file path). Bad entries are skipped.
 */
function compileTeams(list = []) {
  return (Array.isArray(list) ? list : []).map((t) => {
    if (!t || !t.name) return null;
    if (t.regex) {
      try {
        const re = new RegExp(t.regex, 'i');
        return { name: String(t.name), test: (n) => re.test(n) };
      } catch {
        return null;
      }
    }
    if (t.folder) {
      const f = String(t.folder).replace(/\\/g, '/').toLowerCase();
      return { name: String(t.name), test: (n, file) => Boolean(file) && String(file).replace(/\\/g, '/').toLowerCase().includes(f) };
    }
    if (!t.match) return null;
    const word = String(t.match).toLowerCase().replace(/[^a-z0-9]/g, '');
    const where = t.where || 'anywhere';
    return {
      name: String(t.name),
      test: (n) => {
        const w = nameTokens(n);
        if (!w.length) return false;
        if (where === 'start') return w[0] === word;
        if (where === 'end') return w[w.length - 1] === word;
        return w.includes(word);
      },
    };
  }).filter(Boolean);
}

/** The confirmed team of a name (and its file), or null: shared or not known. */
function ownerOf(name, teams = [], file = null) {
  const t = teams.find((x) => x.test(name, file));
  return t ? t.name : null;
}

/** Classes, objects and custom fields of each confirmed team. */
function teamsReport(model, teams = []) {
  const out = teams.map((t) => ({ name: t.name, classes: [], objects: [], fields: [] }));
  const add = (owner, kind, name) => {
    const t = owner && out.find((x) => x.name === owner);
    if (t) t[kind].push(name);
  };
  for (const c of Object.values(model.classes || {})) if (!c.isTest) add(ownerOf(c.name, teams, c.file), 'classes', c.name);
  for (const o of Object.values(model.objects || {})) {
    if (/__c$/i.test(o.name)) add(ownerOf(o.name, teams), 'objects', o.name);
    for (const f of Object.keys(o.fields || {})) if (/__c$/i.test(f)) add(ownerOf(f, teams), 'fields', `${o.name}.${f}`);
  }
  return out;
}

// Words that are roles, Salesforce words or common words, never a team.
const NOT_TEAMS = new Set(('service services serviceimpl impl selector selectors domain domains controller ctrl handler handlers trigger triggers batch batches job jobs '
  + 'queueable schedulable scheduler helper helpers util utils utility test tests mock mocks factory builder wrapper dto request response model vo exception '
  + 'interface base abstract generic common shared core api rest soap callout integration invocable action actions lwc aura page component flow '
  + 'record records type types field fields list map set data date datetime status name id ids value values new old get set update insert delete '
  + 'account contact opportunity opp lead case task event user product order quote contract campaign asset pricebook entry line item '
  + 'conta contato oportunidade caso tarefa usuario produto pedido cotacao contrato campanha ativo linha item de da do das dos e o a para com por '
  + 'the of and to for in on by with c r mdt fflib sobject sobjects').split(/\s+/));

/**
 * Words that repeat in many names (any position, any separator): candidates the person confirms or not. A word in at
 * least `min` names, not a role or common word, not already a confirmed team.
 */
function suggestTeams(model, teams = [], { min = 5, limit = 8 } = {}) {
  const confirmed = new Set(teams.map((t) => t.name.toLowerCase()));
  const counts = new Map();
  const add = (name, kind) => {
    for (const w of new Set(nameTokens(name))) {
      if (w.length < 2 || /^\d+$/.test(w) || NOT_TEAMS.has(w) || confirmed.has(w)) continue;
      const c = counts.get(w) || counts.set(w, { word: w, classes: 0, objects: 0, fields: 0, examples: [], start: 0, end: 0 }).get(w);
      c[kind] += 1;
      const toks = nameTokens(name);
      if (toks[0] === w) c.start += 1;
      if (toks[toks.length - 1] === w) c.end += 1;
      if (c.examples.length < 3) c.examples.push(name);
    }
  };
  for (const c of Object.values(model.classes || {})) if (!c.isTest && !/^fflib_/i.test(c.name)) add(c.name, 'classes');
  for (const o of Object.values(model.objects || {})) {
    if (/__c$/i.test(o.name)) add(o.name, 'objects');
    for (const f of Object.keys(o.fields || {})) if (/__c$/i.test(f)) add(f, 'fields');
  }
  return [...counts.values()]
    .map((c) => ({ ...c, total: c.classes + c.objects + c.fields, where: c.start >= (c.classes + c.objects + c.fields) * 0.8 ? 'start' : c.end >= (c.classes + c.objects + c.fields) * 0.8 ? 'end' : 'anywhere' }))
    .filter((c) => c.total >= min && c.classes >= 2)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
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

/** Public methods of non-test classes, with the confirmed owner (null = shared or not known). */
function catalog(model, teams = []) {
  const out = [];
  for (const c of Object.values(model.classes || {})) {
    if (c.isTest || /^fflib_/i.test(c.name) || (c.kinds || []).includes('interface')) continue;
    const owner = ownerOf(c.name, teams, c.file);
    for (const s of c.signatures || []) {
      if (/^(execute|start|finish|getSObjectType|getSObjectFieldList|construct|on[A-Z]\w*|before\w+|after\w+|handle\w*)$/.test(s.name)) continue;
      out.push({ className: c.name, method: s.name, params: s.params, returns: s.returns, static: s.static, owner, shared: !owner, helperClass: SHARED_NAME.test(c.name), file: c.file, line: s.line });
    }
  }
  return out;
}

/** Search the catalog: every word of the term must appear in the method name, the class name or a parameter. */
function searchHelpers(model, term, { teams = [] } = {}) {
  const list = catalog(model, teams);
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
 * Methods with the same name words in different classes: with confirmed teams, only across different teams; without
 * them, across different classes. Each group is a candidate for one generic method in shared code.
 */
function similarAcrossTeams(model, { teams = [] } = {}) {
  const list = catalog(model, teams);
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
  const label = (h) => h.owner || (teams.length ? 'compartilhado' : 'sem time configurado');
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
    .filter((g) => new Set(g.map((h) => h.className)).size >= 2 && (!teams.length || new Set(g.map(label)).size >= 2))
    .map((g) => ({ method: g[0].method, owners: [...new Set(g.map(label))], where: [...new Set(g.map((h) => `${h.className}.${h.method}(${h.params.join(', ')})`))] }))
    .slice(0, 30);
}

module.exports = { nameTokens, compileTeams, ownerOf, teamsReport, suggestTeams, catalog, searchHelpers, similarAcrossTeams, words };
