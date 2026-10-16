'use strict';

/** Removes comments and string literals (strings are returned apart, for "possible use" checks). */
function stripApex(source) {
  const strings = [];
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:\\.|[^'\\])*'/g, (m) => {
      strings.push(m.slice(1, -1));
      return "''";
    });
  return { code, strings };
}

/** Returns the text between the first "{" after `start` and its matching "}". */
function blockAfter(code, start) {
  const open = code.indexOf('{', start);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    else if (code[i] === '}') {
      depth -= 1;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  return code.slice(open + 1);
}

function unique(list) {
  return [...new Set(list)];
}

const DML_RE = /\b(?:insert|update|upsert|delete|undelete)\s+(\w+)\s*;|Database\.(?:insert|update|upsert|delete|undelete)\s*\(\s*(\w+)|\bregister(?:New|Dirty|Deleted|Upsert)\s*\(\s*(\w+)/gi;
const DECL_RE = /\b(?:List|Set)\s*<\s*(\w+)\s*>\s+(\w+)|\bMap\s*<\s*\w+\s*,\s*(\w+)\s*>\s+(\w+)|\b([A-Z]\w*)\s+(\w+)\s*(?:=|;|,|\))/g;

/** Reads [SELECT ... FROM X] queries, skipping subqueries in parentheses. */
function parseSoql(code) {
  const queries = [];
  const re = /\[\s*SELECT\s+/gi;
  let m;
  while ((m = re.exec(code))) {
    let depth = 0;
    let i = re.lastIndex;
    let fromAt = -1;
    for (; i < code.length && code[i] !== ']'; i += 1) {
      const ch = code[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      else if (depth === 0 && /\s/.test(code[i - 1]) && /^FROM\s/i.test(code.slice(i, i + 5))) {
        fromAt = i;
        break;
      }
    }
    if (fromAt < 0) continue;
    const objectMatch = code.slice(fromAt + 4).match(/^\s+(\w+)/);
    if (!objectMatch) continue;
    const fields = code
      .slice(re.lastIndex, fromAt)
      .replace(/\([\s\S]*?\)/g, ' ')
      .split(',')
      .map((x) => x.trim())
      .filter((x) => /^[\w.]+$/.test(x));
    queries.push({ object: objectMatch[1], fields: unique(fields) });
  }
  return queries;
}

function parseDml(code) {
  const vars = [];
  let m;
  DML_RE.lastIndex = 0;
  while ((m = DML_RE.exec(code))) vars.push(m[1] || m[2] || m[3]);
  const types = {};
  DECL_RE.lastIndex = 0;
  while ((m = DECL_RE.exec(code))) {
    const type = m[1] || m[3] || m[5];
    const name = m[2] || m[4] || m[6];
    if (type && name && !types[name]) types[name] = type;
  }
  const direct = [...code.matchAll(/\b(?:insert|update|upsert|delete)\s+new\s+(?:List\s*<\s*)?(\w+)/gi)].map((x) => ({ variable: null, type: x[1] }));
  const byVar = unique(vars).map((v) => ({ variable: v, type: types[v] || null }));
  const seen = new Set();
  return [...byVar, ...direct].filter((d) => {
    const key = `${d.variable}|${d.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Variable name -> declared type (locals, loop variables, parameters). */
function varTypes(code) {
  const types = {};
  const re = /\b(?:List|Set)\s*<\s*(\w+)\s*>\s+(\w+)|\bMap\s*<\s*\w+\s*,\s*(\w+)\s*>\s+(\w+)|\b([A-Z]\w*)\s+(\w+)\s*(?:=|;|,|\)|:)/g;
  let m;
  while ((m = re.exec(code))) {
    const type = m[1] || m[3] || m[5];
    const name = m[2] || m[4] || m[6];
    if (type && name && !types[name]) types[name] = type;
  }
  return types;
}

/** Custom fields read (not assigned) on a variable: acc.Score__c used in an expression. */
function fieldReads(code) {
  const reads = [];
  const re = /\b([a-z]\w*)\.(\w+__c)\b(?!\s*=[^=])/g;
  let m;
  while ((m = re.exec(code))) reads.push(`${m[1]}.${m[2]}`);
  return unique(reads);
}

function detectKind(name, code) {
  const kinds = [];
  if (/@isTest/i.test(code)) kinds.push('test');
  if (/extends\s+fflib_SObject(Domain|s)\b/i.test(code)) kinds.push('domain');
  if (/extends\s+fflib_SObjectSelector/i.test(code)) kinds.push('selector');
  if (/Database\.Batchable/i.test(code)) kinds.push('batch');
  if (/implements[^{]*\bQueueable\b/i.test(code)) kinds.push('queueable');
  if (/implements[^{]*\bSchedulable\b/i.test(code)) kinds.push('schedulable');
  if (/@InvocableMethod/i.test(code)) kinds.push('invocable');
  if (/@AuraEnabled/i.test(code)) kinds.push('controller');
  if (/fflib_Application/.test(code) && /Factory/.test(code)) kinds.push('application');
  if (/^I\w+Service$/.test(name) || /\binterface\s+\w+/i.test(code.slice(0, 400))) kinds.push('interface');
  if (/Service(Impl)?$/i.test(name) && !kinds.includes('interface')) kinds.push('service');
  if (/TriggerHandler$/i.test(name) || /extends\s+\w*TriggerHandler\b/i.test(code) || /extends\s+fflib_SObjectDomain\b/i.test(code)) kinds.push('trigger-handler');
  return kinds;
}

/** Trigger-phase methods of common frameworks (fflib domains and TriggerHandler-style classes). */
const PHASE_METHOD_RE = /^(on(ApplyDefaults|Validate|Before(Insert|Update|Delete)|After(Insert|Update|Delete|Undelete))|(before|after)(Insert|Update|Delete|Undelete))$/;

/** Number of parameters, ignoring commas inside generics (Map<Id, SObject>). */
function arity(params) {
  let p = params.trim();
  if (!p) return 0;
  while (/<[^<>]*>/.test(p)) p = p.replace(/<[^<>]*>/g, '');
  return p.split(',').length;
}

/**
 * For each trigger-phase method, the identifiers used in its body and in the private helpers it calls
 * (followed inside the class). Key: "name/arity".
 */
function handlerRefs(code) {
  const methods = {};
  const re = /\b(?:(?:public|private|protected|global|static|override|virtual)\s+)+[\w<>,.\s]+?\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let m;
  while ((m = re.exec(code))) {
    const body = blockAfter(code, m.index);
    const entry = methods[m[1]] || { keys: [], ids: new Set(), calls: new Set() };
    entry.keys.push(`${m[1]}/${arity(m[2])}`);
    for (const id of body.match(/\b[A-Z]\w+\b/g) || []) entry.ids.add(id);
    for (const x of body.matchAll(/\b(\w+)\.class\b/g)) entry.ids.add(x[1]);
    for (const x of body.matchAll(/(?:^|[^.\w])(\w+)\s*\(/g)) entry.calls.add(x[1]);
    methods[m[1]] = entry;
  }
  const out = {};
  for (const [name, entry] of Object.entries(methods)) {
    if (!PHASE_METHOD_RE.test(name)) continue;
    const ids = new Set(entry.ids);
    const seen = new Set([name]);
    const queue = [...entry.calls];
    while (queue.length) {
      const call = queue.shift();
      if (seen.has(call) || !methods[call]) continue;
      seen.add(call);
      for (const id of methods[call].ids) ids.add(id);
      queue.push(...methods[call].calls);
    }
    for (const key of entry.keys) out[key] = [...ids];
  }
  return out;
}

/** Parses the fflib Application class: interface -> implementation and object -> selector/domain. */
function parseApplication(code) {
  const result = { services: {}, selectors: {}, domains: {} };
  const factories = [
    ['services', /ServiceFactory/g],
    ['selectors', /SelectorFactory/g],
    ['domains', /DomainFactory/g],
  ];
  const marks = [];
  for (const [kind, re] of factories) {
    let m;
    while ((m = re.exec(code))) marks.push({ kind, index: m.index });
  }
  marks.sort((a, b) => a.index - b.index);
  marks.forEach((mark, i) => {
    const segment = code.slice(mark.index, i + 1 < marks.length ? marks[i + 1].index : undefined);
    const pairRe = /(\w+)\.(?:class|SObjectType)\s*=>\s*(\w+)(?:\.\w+)?\.class/gi;
    let p;
    while ((p = pairRe.exec(segment))) result[mark.kind][p[1]] = p[2];
  });
  return result;
}

function parseApexClass(name, source) {
  const { code, strings } = stripApex(source);
  const kinds = detectKind(name, code);
  const info = {
    name,
    kinds,
    isTest: kinds.includes('test'),
    identifiers: unique((code.match(/\b[A-Z]\w+\b/g) || []).filter((id) => id !== name)),
    classRefs: unique([...code.matchAll(/\b(\w+)\.class\b/g)].map((m) => m[1])),
    calls: unique([...code.matchAll(/\b([A-Z]\w*)\.(\w+)\s*\(/g)].map((m) => `${m[1]}.${m[2]}`)),
    invoked: unique([...code.matchAll(/\.(\w+)\s*\(/g)].map((m) => m[1])),
    methods: unique([...code.matchAll(/\b(?:(?:public|private|protected|global|static|override|virtual)\s+)+[\w<>,.\s]+?\s+(\w+)\s*\([^)]*\)\s*\{/g)].map((m) => m[1])),
    soql: parseSoql(code),
    dml: parseDml(code),
    fieldRefs: unique([...code.matchAll(/\b(?:(\w+)\.)?(\w+__(?:c|r))\b/g)].map((m) => (m[1] ? `${m[1]}.${m[2]}` : m[2]))),
    enqueues: unique([...code.matchAll(/(?:System\.enqueueJob|Database\.executeBatch)\s*\(\s*new\s+(\w+)/gi)].map((m) => m[1])),
    varTypes: varTypes(code),
    fieldReads: fieldReads(code),
    dynamicSoql: /Database\.query(WithBinds)?\s*\(/i.test(code) || strings.some((x) => /^\s*SELECT\s/i.test(x)),
    runAs: /System\.runAs\s*\(/i.test(code),
    async: /@future/i.test(code) || /System\.enqueueJob|Database\.executeBatch|System\.schedule/i.test(code),
    strings: unique(strings.filter((s) => /^[A-Za-z_]\w{2,}$/.test(s))).slice(0, 50),
  };
  const ext = code.match(/\bclass\s+\w+\s+extends\s+(\w+)/i);
  info.extendsName = ext ? ext[1] : null;
  const phases = handlerRefs(code);
  if (Object.keys(phases).length) info.handlerRefs = phases;
  if (kinds.includes('selector')) {
    const obj = code.match(/getSObjectType\s*\(\s*\)\s*\{[^}]*?return\s+(\w+)\.SObjectType/i);
    info.selectorObject = obj ? obj[1] : null;
    const idx = code.search(/getSObjectFieldList\s*\(/i);
    const body = idx >= 0 ? blockAfter(code, idx) : '';
    info.selectorFields = unique([...body.matchAll(/\b(\w+)\.(\w+)\b/g)].filter((m) => m[1] !== 'Schema').map((m) => `${m[1]}.${m[2]}`));
  }
  if (kinds.includes('application')) info.application = parseApplication(code);
  return info;
}

function parseTrigger(name, source) {
  const { code } = stripApex(source);
  const head = code.match(/trigger\s+(\w+)\s+on\s+(\w+)\s*\(([^)]*)\)/i);
  const events = head ? head[3].split(',').map((e) => e.trim().toLowerCase().replace(/\s+/g, ' ')) : [];
  return {
    name: head ? head[1] : name,
    object: head ? head[2] : null,
    events,
    identifiers: unique((code.match(/\b[A-Z]\w+\b/g) || []).filter((id) => !head || (id !== head[1] && id !== head[2]))),
    classRefs: unique([...code.matchAll(/\b(\w+)\.class\b/g)].map((m) => m[1])),
  };
}

module.exports = { handlerRefs, PHASE_METHOD_RE, stripApex, parseApexClass, parseTrigger, parseSoql, parseDml, parseApplication, blockAfter };
