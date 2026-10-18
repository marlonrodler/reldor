'use strict';

/**
 * Field references with the object they belong to.
 *
 * "Where is Account.Score__c used?" must not count Score__c of another object. At index time each file records
 * what its code says about every custom field it touches: the base the reference starts from (a type, an object,
 * a SOQL FROM, a flow element) and the path to the field. At query time `resolveRef` turns that into an object
 * using the model (lookups, child relationships). What cannot be tied to one object is kept and reported as such.
 *
 * A reference: { field, base, path, how, line } where
 *   base = object or type name ("Account"), "rel:<Parent>:<ChildRelationship>" for a SOQL subquery, or null;
 *   path = segments after the base, the last one is the field (["Parent__r", "Score__c"]);
 *   how  = how the base was found, in the words the report shows.
 */

const { stripApexComments } = require('./apex');

const FIELD_TOKEN = /\b([A-Za-z]\w*__[cr])\b/g;

/** Line number (1-based) of an index. */
function lineAt(text, index) {
  let n = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) n += 1;
  return n;
}

/** Same text with every string literal's content blanked (positions kept). */
function maskStrings(code) {
  return code.replace(/'(?:\\.|[^'\\\n])*'/g, (m) => `'${' '.repeat(m.length - 2)}'`);
}

/** Element type of a declared type: List<Account> / Account[] / Set<Account> / Map<Id, Account> -> Account. */
function elementType(type) {
  let t = String(type).replace(/\s+/g, '');
  // Unwrap until a plain type: Map<Id, List<Account>> -> List<Account> -> Account
  for (let i = 0; i < 4; i += 1) {
    let m;
    if ((m = /^(?:List|Set)<(.+)>$/i.exec(t))) t = m[1];
    else if ((m = /^Map<[\w.]+,(.+)>$/i.exec(t))) t = m[1];
    else if ((m = /^(.+)\[\]$/.exec(t))) t = m[1];
    else break;
  }
  return t;
}

const INNER = '(?:(?:List|Set)\\s*<\\s*[\\w.]+\\s*>|[\\w.]+)';
const TYPE = `(?:(?:List|Set)\\s*<\\s*${INNER}\\s*>|Map\\s*<\\s*[\\w.]+\\s*,\\s*${INNER}\\s*>|[\\w.]+(?:\\s*\\[\\s*\\])?)`;
const KEYWORDS = new Set(['return', 'new', 'else', 'throw', 'case', 'when', 'insert', 'update', 'upsert', 'delete', 'undelete', 'merge', 'final', 'static', 'public', 'private', 'protected', 'global', 'override', 'virtual', 'abstract', 'transient', 'with', 'without', 'sharing', 'class', 'interface', 'enum', 'extends', 'implements', 'void', 'if', 'for', 'while', 'do', 'try', 'catch', 'finally', 'instanceof', 'this', 'super']);

/** Declarations in a piece of code: variable -> declared type (raw, e.g. "List<Account>"). */
function declarations(code) {
  const out = Object.create(null);
  const re = new RegExp(`(?:^|[^\\w.])(${TYPE})\\s+([A-Za-z_]\\w*)\\s*(?=[=;,):{])`, 'gi');
  let m;
  while ((m = re.exec(code))) {
    const type = m[1].trim();
    const name = m[2];
    if (KEYWORDS.has(type.toLowerCase()) || KEYWORDS.has(name.toLowerCase())) continue;
    const key = name.toLowerCase(); // Apex names ignore case
    if (!(key in out)) out[key] = type;
  }
  return out;
}

/** Method blocks: { name, returnType, start (signature), open, close, params }. */
function methodBlocks(code) {
  const out = [];
  const re = new RegExp(`\\b(?:(?:public|private|protected|global|static|override|virtual|abstract|testmethod|webservice)\\s+)*(${TYPE}|void)\\s+([A-Za-z_]\\w*)\\s*\\(([^()]*)\\)\\s*(?:throws\\s+[\\w.,\\s]+)?\\{`, 'gi');
  let m;
  while ((m = re.exec(code))) {
    if (KEYWORDS.has(m[2].toLowerCase()) || /^(if|for|while|catch|switch)$/i.test(m[1])) continue;
    const open = code.indexOf('{', m.index + m[0].length - 1);
    let depth = 0;
    let close = open;
    for (let i = open; i < code.length; i += 1) {
      if (code[i] === '{') depth += 1;
      else if (code[i] === '}') {
        depth -= 1;
        if (!depth) {
          close = i;
          break;
        }
      }
    }
    out.push({ name: m[2], returnType: m[1], start: m.index, open, close, params: m[3] });
  }
  return out;
}

/** Walks back from `end` over one primary expression: name, name[...], name(...), (cast) expr. */
function chainBefore(code, end) {
  // Returns segments from the base to the one before the field, e.g. "accs[0].Parent__r." -> ['accs', 'Parent__r'].
  const segs = [];
  let i = end;
  for (;;) {
    let j = i - 1;
    while (j >= 0 && /\s/.test(code[j])) j -= 1;
    if (code[j] !== '.') break;
    j -= 1;
    if (code[j] === '?') j -= 1; // safe navigation record?.Field__c
    while (j >= 0 && /\s/.test(code[j])) j -= 1;
    // skip [..] and (..) groups
    let call = false;
    let indexed = false;
    while (j >= 0 && (code[j] === ']' || code[j] === ')')) {
      const closeIdx = j;
      const closeCh = code[j];
      const openCh = closeCh === ']' ? '[' : '(';
      let depth = 0;
      for (; j >= 0; j -= 1) {
        if (code[j] === closeCh) depth += 1;
        else if (code[j] === openCh) {
          depth -= 1;
          if (!depth) break;
        }
      }
      if (closeCh === ')') call = true;
      else indexed = true;
      const groupStart = j;
      j -= 1;
      while (j >= 0 && /\s/.test(code[j])) j -= 1;
      if (closeCh === ')' && !/[\w]/.test(code[j] || '')) {
        // A parenthesised expression: ((Account) x).Field__c
        const inner = code.slice(groupStart + 1, closeIdx);
        const cast = /^\s*\(\s*([\w.]+)\s*\)/.exec(inner);
        if (cast) {
          segs.unshift({ name: cast[1], cast: true });
          return segs;
        }
        // (newMap.get(id)).Field__c / (records[0]).Field__c: the element of a typed collection
        const el = /^\s*([A-Za-z_]\w*)\s*((?:\.\s*(?:get|values)\s*\((?:[^()]|\([^()]*\))*\)|\[[^\]]*\])*)\s*$/.exec(inner);
        segs.unshift(el ? { name: el[1], indexed: Boolean(el[2]) } : { name: null });
        return segs;
      }
    }
    let k = j;
    while (k >= 0 && /\w/.test(code[k])) k -= 1;
    const name = code.slice(k + 1, j + 1);
    if (!name) break;
    segs.unshift({ name, call, indexed });
    i = k + 1;
  }
  return segs;
}

/** Types of the methods of a class, by name (lower case): return type. */
function returnTypes(blocks) {
  const out = Object.create(null);
  for (const b of blocks) if (!(b.name.toLowerCase() in out)) out[b.name.toLowerCase()] = b.returnType;
  return out;
}

/** Fields inside a SOQL text, with their FROM object; subqueries get the child relationship as base. */
function soqlRefs(text, offset, src, how, outer = null) {
  const refs = [];
  let body = text;
  // Subqueries first: (SELECT ... FROM Rel ...)
  const subRe = /\(\s*SELECT\s/gi;
  let m;
  const mainFrom = /\bFROM\s+(\w+)/i.exec(stripSubqueries(text));
  const main = mainFrom ? mainFrom[1] : null;
  while ((m = subRe.exec(text))) {
    let depth = 0;
    let end = m.index;
    for (let i = m.index; i < text.length; i += 1) {
      if (text[i] === '(') depth += 1;
      else if (text[i] === ')') {
        depth -= 1;
        if (!depth) {
          end = i;
          break;
        }
      }
    }
    const inner = text.slice(m.index + 1, end);
    const relFrom = /\bFROM\s+(\w+)/i.exec(inner);
    const base = relFrom ? `rel:${main || ''}:${relFrom[1]}` : null;
    for (const r of soqlRefs(inner.replace(/^\s*/, ''), offset + m.index + 1, src, how, base)) refs.push(r);
    body = body.slice(0, m.index) + ' '.repeat(end - m.index + 1) + body.slice(end + 1);
    subRe.lastIndex = end;
  }
  const base = outer || main;
  // FROM Account a ... a.Name: the alias is the object
  const aliasM = /\bFROM\s+\w+\s+(?!WHERE\b|WITH\b|ORDER\b|GROUP\b|LIMIT\b|OFFSET\b|FOR\b|USING\b|HAVING\b)([A-Za-z_]\w*)/i.exec(stripSubqueries(body));
  const alias = aliasM ? aliasM[1].toLowerCase() : null;
  // Bind variables (:acc.Score__c) belong to Apex, not to the query object.
  const scan = body.replace(/:\s*[\w.]+(\([^)]*\))?/g, (x) => ' '.repeat(x.length));
  for (const t of scan.matchAll(/\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\b/g)) {
    let parts = t[1].split('.');
    if (!/__c$/i.test(parts[parts.length - 1])) continue;
    if (parts.length > 1 && alias && parts[0].toLowerCase() === alias) parts = parts.slice(1);
    refs.push({ field: parts[parts.length - 1], base, path: parts, how, line: src === null ? 0 : lineAt(src, offset + t.index), pos: offset + t.index });
  }
  return refs;
}

function stripSubqueries(text) {
  let out = '';
  let depth = 0;
  let inSub = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(' && !inSub && /^\(\s*SELECT\s/i.test(text.slice(i, i + 400))) inSub = depth + 1;
    if (ch === '(') depth += 1;
    if (!inSub) out += ch;
    else out += ' ';
    if (ch === ')') {
      if (inSub === depth) inSub = 0;
      depth -= 1;
    }
  }
  return out;
}

/**
 * Field references in an Apex class or trigger. `triggerObject` is the object of a trigger file.
 */
function apexFieldRefs(source, { triggerObject = null } = {}) {
  const clean = stripApexComments(source);
  const code = maskStrings(clean);
  const refs = [];
  const blocks = methodBlocks(code);
  const returns = returnTypes(blocks);

  // Class-level declarations: everything outside method bodies.
  let outside = code;
  for (const b of blocks) outside = outside.slice(0, b.open + 1) + ' '.repeat(Math.max(0, b.close - b.open - 1)) + outside.slice(b.close);
  const classTypes = declarations(outside);
  const typesAt = (index) => {
    const b = blocks.filter((x) => index > x.open && index < x.close).sort((p, q) => q.open - p.open)[0];
    if (!b) return classTypes;
    if (!b.types) b.types = Object.assign(Object.create(null), classTypes, declarations(`(${b.params})`), declarations(code.slice(b.open, b.close)));
    return b.types;
  };
  const methodAt = (index) => blocks.filter((x) => index > x.open && index < x.close).sort((p, q) => q.open - p.open)[0] || null;

  // SOQL in brackets.
  const soqlRanges = [];
  for (const m of code.matchAll(/\[\s*SELECT\s/gi)) {
    let depth = 0;
    let end = m.index;
    for (let i = m.index; i < code.length; i += 1) {
      if (code[i] === '[') depth += 1;
      else if (code[i] === ']') {
        depth -= 1;
        if (!depth) {
          end = i;
          break;
        }
      }
    }
    soqlRanges.push([m.index, end]);
    refs.push(...soqlRefs(code.slice(m.index + 1, end), m.index + 1, code, 'consulta (SOQL)').map(({ pos, ...r }) => r));
  }
  const inSoql = (i) => soqlRanges.some(([a, b]) => i > a && i < b);

  // SOQL and field names in strings (dynamic SOQL, field lists, sObject.get('Field__c')).
  const strings = [...clean.matchAll(/'((?:\\.|[^'\\\n])*)'/g)];
  const statementFrom = (index) => {
    // FROM <object> in the strings of the same statement, else the only FROM object in the method's strings.
    const a = code.lastIndexOf(';', index - 1) + 1;
    const bRaw = code.indexOf(';', index);
    const b = bRaw < 0 ? code.length : bRaw;
    const stmt = strings.filter((s) => s.index >= a && s.index < b).map((s) => s[1]).join(' ');
    const here = /\bFROM\s+(\w+)/i.exec(stmt);
    if (here) return { object: here[1], how: 'SOQL montada em texto' };
    // A query builder: .withFrom(Allocation__c.SObjectType).withWhere('Opportunity__c IN :ids')
    const typed = [...new Set([...code.slice(a, b).matchAll(/\b([A-Za-z]\w*)\s*\.\s*SObjectType\b|\bSObjectType\s*\.\s*([A-Za-z]\w*)/gi)].map((x) => (x[1] || x[2]).toLowerCase()).filter((x) => x !== 'schema'))];
    if (typed.length === 1) {
      const t = /\b([A-Za-z]\w*)\s*\.\s*SObjectType\b|\bSObjectType\s*\.\s*([A-Za-z]\w*)/i.exec(code.slice(a, b).replace(/\bSchema\s*\./g, ''));
      if (t) return { object: t[1] || t[2], how: `o mesmo comando usa ${t[1] || t[2]}.SObjectType` };
    }
    const mth = methodAt(index);
    if (!mth) return null;
    const objs = new Set(strings.filter((s) => s.index > mth.open && s.index < mth.close).flatMap((s) => [...s[1].matchAll(/\bFROM\s+(\w+)/gi)].map((x) => x[1].toLowerCase())));
    if (objs.size === 1) {
      const one = strings.find((s) => s.index > mth.open && s.index < mth.close && /\bFROM\s+\w+/i.test(s[1]));
      return { object: /\bFROM\s+(\w+)/i.exec(one[1])[1], how: 'SOQL montada em texto no mesmo método' };
    }
    return null;
  };
  // A query built over several statements of one method (q = 'SELECT ...'; q += ' FROM X'): join the strings
  // assigned to the same variable and read them as one SOQL.
  const handled = new Set();
  const assignedVar = (index) => {
    const a = Math.max(code.lastIndexOf(';', index - 1), code.lastIndexOf('{', index - 1), code.lastIndexOf('}', index - 1)) + 1;
    const m = /([A-Za-z_]\w*)\s*\+?=(?!=)/.exec(code.slice(a, index));
    return m ? m[1] : null;
  };
  // The variable or method a string goes to: objectName = 'X' / withObject('X') / withField('X')
  const wordBefore = (src, index) => {
    const m = /([A-Za-z_]\w*)\s*(?:=|\(|,)\s*$/.exec(src.slice(Math.max(0, index - 80), index));
    return m ? m[1] : null;
  };
  // Single-word strings of the same statement: .withField('Status__c').withObject('Service__c')
  const statementStrings = (index) => {
    const a = code.lastIndexOf(';', index - 1) + 1;
    const bRaw = code.indexOf(';', index);
    const b = bRaw < 0 ? code.length : bRaw;
    return strings.filter((x) => x.index >= a && x.index < b && x.index !== index && /^\s*[A-Za-z]\w*\s*$/.test(x[1])).map((x) => x[1].trim());
  };
  const groups = new Map();
  for (const s of strings) {
    const mth = methodAt(s.index);
    const v = assignedVar(s.index);
    if (!v) continue;
    const key = `${mth ? mth.open : -1}|${v}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const list of groups.values()) {
    if (!list.some((x) => /__c\b/i.test(x[1]))) continue;
    const first = list.findIndex((x) => /\bSELECT\s/i.test(x[1]));
    if (first < 0) continue;
    const parts = list.slice(first);
    let joined = '';
    const spans = [];
    for (const x of parts) {
      spans.push({ from: joined.length, to: joined.length + x[1].length, s: x });
      joined += `${x[1]} `;
    }
    if (!/\bFROM\s+\w+/i.test(joined)) continue;
    for (const r of soqlRefs(joined, 0, null, 'SOQL montada em texto')) {
      const span = spans.find((sp) => r.pos >= sp.from && r.pos <= sp.to);
      r.line = span ? lineAt(clean, span.s.index) : 0;
      delete r.pos;
      refs.push(r);
    }
    for (const x of parts) handled.add(x.index);
  }

  for (const s of strings) {
    const value = s[1];
    if (!/__c\b/i.test(value) || handled.has(s.index)) continue;
    if (/^\s*SELECT\s/i.test(value) && /\bFROM\s+\w+/i.test(value)) {
      refs.push(...soqlRefs(value, s.index + 1, clean, 'SOQL montada em texto').map(({ pos, ...r }) => r));
      continue;
    }
    // A sentence (an assert or error message) that mentions a field is not a use of it.
    if (/\s/.test(value.trim()) && !/[=<>!,()]|\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|INCLUDES|EXCLUDES|ORDER|GROUP|LIMIT|ASC|DESC|NULLS)\b/.test(value)) {
      for (const t of value.matchAll(/\b([A-Za-z]\w*__c)\b/g)) refs.push({ field: t[1], base: null, path: [t[1]], how: 'nome do campo numa frase (mensagem)', line: lineAt(clean, s.index), prose: true });
      continue;
    }
    // sObject.get('Field__c') / put('Field__c', ...) on a typed variable
    const before = code.slice(Math.max(0, s.index - 80), s.index);
    const getPut = /([A-Za-z_]\w*)\s*\.\s*(?:get|put|getSObject|getSObjects)\s*\(\s*$/.exec(before);
    const from = statementFrom(s.index);
    for (const t of value.matchAll(/([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/g)) {
      const parts = t[1].split('.');
      if (!/__c$/i.test(parts[parts.length - 1])) continue;
      const line = lineAt(clean, s.index);
      if (getPut) {
        const type = typesAt(s.index)[getPut[1].toLowerCase()];
        const el = type ? elementType(type) : null;
        if (el && !/^s?object$/i.test(el)) {
          refs.push({ field: parts[parts.length - 1], base: el, path: parts, how: `${getPut[1]}.get('...') em ${el}`, line });
          continue;
        }
      }
      if (parts.length > 1) refs.push({ field: parts[parts.length - 1], base: parts[0], path: parts.slice(1), how: 'nome do campo em texto (Objeto.Campo)', line, qualifiedText: true });
      else if (from) refs.push({ field: parts[0], base: from.object, path: parts, how: from.how, line });
      else if (value.trim() === parts[0]) refs.push({ field: parts[0], base: null, path: parts, how: `texto '${parts[0]}'`, line, bareString: true, nearStrings: statementStrings(s.index), contextWord: wordBefore(code, s.index) });
      else refs.push({ field: parts[0], base: null, path: parts, how: 'nome do campo em texto (SOQL dinâmica ou lista de campos)', line });
    }
  }

  // Field tokens in code.
  for (const m of code.matchAll(FIELD_TOKEN)) {
    const field = m[1];
    if (/__r$/i.test(field)) continue; // relationships count through the field at the end of the path
    if (inSoql(m.index)) {
      // :contact.Interest__c inside a query is Apex (a bind), not a field of the queried object
      let k = m.index - 1;
      while (k >= 0 && /[\w.\s?]/.test(code[k]) && code[k] !== '\n') k -= 1;
      const bindStart = code.slice(k + 1, m.index).search(/\S/);
      if (code[k] !== ':' && !(bindStart >= 0 && code[k + 1 + bindStart] === ':')) continue;
    }
    const prev = code[m.index - 1];
    if (prev && /\w/.test(prev)) continue;
    const line = lineAt(code, m.index);
    // Follow the chain after the token: Parent__r.Field__c is counted at Field__c; here the token is the field.
    const segs = chainBefore(code, m.index);
    if (!segs.length) {
      // new Account(Field__c = ...), or a bare name.
      // Apex cannot name a field without a record or a type before it, so a bare name is an object
      // (List<Program__c>, Program__c.SObjectType) unless it is an argument of new Account(Field__c = ...).
      const opener = enclosingNew(code, m.index);
      if (opener && /^\s*=(?!=)/.test(code.slice(m.index + field.length, m.index + field.length + 3))) refs.push({ field, base: opener, path: [field], how: `new ${opener}(...)`, line });
      continue;
    }
    let base = null;
    let how = '';
    let rest = segs.slice(1);
    const head = segs[0];
    const types = typesAt(m.index);
    let rawType = null;
    if (head.cast) {
      base = head.name;
      how = `conversão (${head.name})`;
    } else if (head.name && /^(this)$/i.test(head.name) && segs[1]) {
      rawType = types[segs[1].name.toLowerCase()] || null;
      base = rawType ? elementType(rawType) : null;
      how = rawType ? `variável ${segs[1].name} (${rawType.replace(/\s+/g, '')})` : '';
      rest = segs.slice(2);
    } else if (head.name && /^Trigger$/i.test(head.name) && segs[1] && /^(new|old|newMap|oldMap)$/i.test(segs[1].name)) {
      base = triggerObject;
      rawType = /map$/i.test(segs[1].name) ? 'Map<Id,X>' : 'List<X>';
      how = triggerObject ? `Trigger.${segs[1].name} de ${triggerObject}` : '';
      rest = segs.slice(2);
    } else if (head.name && (/^(Schema|SObjectType)$/i.test(head.name) || (segs[1] && /^SObjectType$/i.test(segs[1].name)))) {
      // Schema.SObjectType.Account.fields.Score__c / SObjectType.Account.Fields.Score__c / Schema.Account.Score__c
      const names = segs.filter((x) => !/^(Schema|SObjectType|fields)$/i.test(x.name));
      if (!names.length) continue; // Schema.SObjectType.Program__c: the token is the object itself
      base = names[0] ? names[0].name : null;
      rest = names.slice(1);
      how = base ? `tipo ${base}` : '';
    } else if (head.name && head.call && !head.indexed && returns[head.name.toLowerCase()]) {
      rawType = returns[head.name.toLowerCase()];
      base = elementType(rawType);
      how = `retorno de ${head.name}()`;
    } else if (head.name && types[head.name.toLowerCase()]) {
      rawType = types[head.name.toLowerCase()];
      base = elementType(rawType);
      how = `variável ${head.name} (${rawType.replace(/\s+/g, '')})`;
    } else if (head.name && (/^[A-Z]/.test(head.name) || /__c$/i.test(head.name))) {
      base = head.name; // a type used directly: Account.Score__c, Obj__c.Field__c
      how = `tipo ${head.name}`;
    }
    // Account.fields.Score__c (SObjectField through the describe shortcut)
    if (base && !rawType) rest = rest.filter((x) => !/^fields$/i.test(x.name));
    // map.get(id).Field__c / list.get(0).Field__c: the element type already is the base.
    if (rawType && /^(map|list|set)\b|\[\s*\]$/i.test(rawType.trim()) && rest[0] && rest[0].call && /^(get|values)$/i.test(rest[0].name)) rest = rest.slice(1);
    // Utils.getSettings().Field__c / service.current().Field__c: the method's return type, worked out at query time
    const firstCall = rest.findIndex((n) => n.call);
    if (firstCall === 0 && !rest.slice(1).some((n) => n.call || n.name === null) && rest[0].name) {
      const owner = rawType && !/^(map|list|set)\b|\[\s*\]$/i.test(rawType.trim()) ? elementType(rawType) : !rawType && head.name && /^[A-Za-z]/.test(head.name) && !types[head.name.toLowerCase()] ? head.name : null;
      if (owner) {
        base = `ret:${owner}.${rest[0].name}`;
        how = `retorno de ${owner}.${rest[0].name}()`;
        rest = rest.slice(1);
      }
    }
    if (rest.some((n) => n.call || n.name === null)) {
      base = null;
      how = '';
    }
    rest = rest.map((x) => x.name);
    if (base && /^s?object$/i.test(base)) {
      base = null;
      how = 'variável do tipo SObject (genérica)';
    }
    refs.push({ field, base, path: [...rest, field], how: how || 'expressão que o Reldor não consegue tipar', line });
  }
  return { refs: dedupe(refs), propertyTypes: classTypes, methodReturns: returns, innerPropertyTypes: innerClassTypes(code, blocks), ...dmlByMethod(code, blocks, typesAt, returns) };
}

/** Properties of inner classes (class Wrapper { public Account conta; }), by inner class name (lower case). */
function innerClassTypes(code, blocks) {
  const out = Object.create(null);
  const heads = [...code.matchAll(/\bclass\s+([A-Za-z_]\w*)[^{;]*\{/gi)];
  for (const h of heads.slice(1)) {
    const open = code.indexOf('{', h.index);
    let depth = 0;
    let close = open;
    for (let i = open; i < code.length; i += 1) {
      if (code[i] === '{') depth += 1;
      else if (code[i] === '}') {
        depth -= 1;
        if (!depth) {
          close = i;
          break;
        }
      }
    }
    let body = code.slice(open + 1, close);
    for (const b of blocks) if (b.open > open && b.close < close) body = body.slice(0, b.open - open) + ' '.repeat(Math.max(0, b.close - b.open)) + body.slice(b.close - open);
    out[h[1].toLowerCase()] = declarations(body);
  }
  return out;
}

/**
 * What each method saves (insert/update/upsert, Database.*, fflib unit of work) and builds (new X(...)), with the
 * type of the expression worked out from the method's own declarations.
 */
function dmlByMethod(code, blocks, typesAt, returns) {
  const saves = Object.create(null);
  const builds = Object.create(null);
  const dml = [];
  const typeOf = (expr, at) => {
    const e = expr.trim();
    let m;
    if ((m = /^new\s+(?:List\s*<\s*([\w.]+)\s*>|([\w.]+)\s*\[\s*\]|([\w.]+))/i.exec(e))) return m[1] || m[2] || m[3];
    if ((m = /^\(\s*(?:List\s*<\s*([\w.]+)\s*>|([\w.]+))\s*\)/.exec(e))) return m[1] || m[2];
    if ((m = /^(?:this\s*\.\s*)?([A-Za-z_]\w*)/.exec(e))) {
      const types = typesAt(at);
      if (types[m[1].toLowerCase()]) return elementType(types[m[1].toLowerCase()]);
      if (new RegExp(`^${m[1]}\\s*\\(`).test(e) && returns[m[1].toLowerCase()]) return elementType(returns[m[1].toLowerCase()]);
    }
    return null;
  };
  const record = (op, expr, at) => {
    const type = typeOf(expr, at);
    const b = blocks.filter((x) => at > x.open && at < x.close).sort((p, q) => q.open - p.open)[0];
    const variable = (/^\s*(?:this\s*\.\s*)?([A-Za-z_]\w*)\s*$/.exec(expr) || [])[1] || null;
    dml.push({ op, variable, type, line: lineAt(code, at) });
    if (b && type && /^(insert|update|upsert|merge)$/i.test(op)) (saves[b.name] = saves[b.name] || []).includes(type) || saves[b.name].push(type);
  };
  for (const m of code.matchAll(/\b(insert|update|upsert|delete|undelete|merge)\s+(?:as\s+(?:user|system)\s+)?([^;]+);/gi)) {
    if (/^\s*[=(.]/.test(m[2]) || /^(new|return)$/i.test(m[1])) continue;
    const two = /^\s*([\w.\[\]()]+)\s+[\w.]+\s*$/.exec(m[2]);
    record(m[1].toLowerCase(), m[1].toLowerCase() === 'upsert' && two ? two[1] : m[2], m.index);
  }
  for (const m of code.matchAll(/Database\s*\.\s*(insert|update|upsert|delete|undelete|merge)\w*\s*\(\s*([^;]+)/gi)) record(m[1].toLowerCase(), m[2], m.index);
  for (const m of code.matchAll(/\bregister(New|Dirty|Upsert|Deleted)\s*\(\s*([^;]+)/g)) record(m[1] === 'Deleted' ? 'delete' : 'upsert', m[2], m.index);
  // Calls on typed variables: service.enable() -> GiftEntryService.enable
  const typedCalls = Object.create(null);
  for (const b of blocks) {
    const body = code.slice(b.open, b.close);
    const made = [...new Set([...body.matchAll(/\bnew\s+([A-Za-z]\w*)\s*\(/g)].map((x) => x[1]))];
    if (made.length) builds[b.name] = [...new Set([...(builds[b.name] || []), ...made])];
    const types = typesAt(b.open + 1);
    const calls = new Set();
    for (const x of body.matchAll(/(?:^|[^.\w])(?:this\s*\.\s*)?([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)\s*\(/g)) {
      const t = types[x[1].toLowerCase()];
      if (t && !/^(list|set|map)\b|\[\s*\]$/i.test(t.trim())) calls.add(`${elementType(t)}.${x[2]}`);
    }
    if (calls.size) typedCalls[b.name] = [...calls];
  }
  return { dml, methodSaves: saves, methodBuilds: builds, typedCalls };
}

/** "new Account(" around a position, when the position is one of its Field = value arguments. */
function enclosingNew(code, index) {
  let depth = 0;
  for (let i = index - 1; i >= 0 && index - i < 4000; i -= 1) {
    const ch = code[i];
    if (ch === ')') depth += 1;
    else if (ch === '(') {
      if (!depth) {
        const m = /new\s+([\w.]+)\s*$/.exec(code.slice(Math.max(0, i - 400), i));
        return m ? m[1] : null;
      }
      depth -= 1;
    } else if ((ch === ';' || ch === '{' || ch === '}') && !depth) return null;
  }
  return null;
}

function dedupe(refs) {
  const seen = new Set();
  return refs.filter((r) => {
    const k = `${r.field}|${r.base}|${r.path.join('.')}|${r.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ------------------------------------------------------------------ flows */

/**
 * Field references in a flow: $Record, typed variables, Get/Create/Update/Delete Records elements and the fields
 * listed under them. `parsed` is the Flow object of the parsed XML; `object` the record-triggered object.
 */
function flowFieldRefs(parsed, object, raw) {
  const arr = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
  const names = Object.create(null); // element or variable name -> object
  names.$record = object;
  names.$record__prior = object;
  for (const v of arr(parsed.variables)) if (v.objectType) names[String(v.name).toLowerCase()] = v.objectType;
  const elements = [];
  for (const kind of ['recordLookups', 'recordCreates', 'recordUpdates', 'recordDeletes']) {
    for (const e of arr(parsed[kind])) {
      const obj = e.object || (e.inputReference && names[String(e.inputReference).toLowerCase()]) || null;
      if (e.name && obj) names[String(e.name).toLowerCase()] = obj;
      elements.push({ kind, e, obj });
    }
  }
  // Loops over a collection keep the collection's object.
  for (const l of arr(parsed.loops)) {
    const coll = l.collectionReference && names[String(l.collectionReference).toLowerCase()];
    if (l.name && coll) names[String(l.name).toLowerCase()] = coll;
  }
  const refs = [];
  for (const { kind, e, obj } of elements) {
    const label = { recordLookups: 'Get Records', recordCreates: 'Create Records', recordUpdates: 'Update Records', recordDeletes: 'Delete Records' }[kind];
    const fields = [...arr(e.queriedFields), ...arr(e.filters).map((f) => f.field), ...arr(e.inputAssignments).map((a) => a.field), ...arr(e.outputAssignments).map((a) => a.field), e.sortField];
    for (const f of fields) if (f && /__c$/i.test(f)) refs.push({ field: f, base: obj, path: [f], how: `${label} ${e.name || ''}`.trim(), line: 0 });
  }
  for (const d of arr(parsed.dynamicChoiceSets)) {
    const obj = d.object || d.picklistObject || null;
    const fields = [d.displayField, d.valueField, d.sortField, d.picklistField, ...arr(d.filters).map((f) => f.field), ...arr(d.outputAssignments).map((a) => a.field)];
    for (const f of fields) if (f && /__c$/i.test(f)) refs.push({ field: f, base: obj, path: [f], how: `lista de opções ${d.name || ''}`.trim(), line: 0 });
  }
  // Any other value that names a field (sort fields, screen components' field lists...): the object of the
  // nearest element that says one (object, dataTypeMappings typeValue, objectType).
  const SKIP_KEYS = /^(name|label|description|locationX|locationY|processType|apiVersion|interviewLabel|status|actionName|flowName|elementReference|assignToReference|leftValueReference|targetReference|inputReference|outputReference|collectionReference)$/;
  const contextObject = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (typeof node.object === 'string') return node.object;
    if (typeof node.objectType === 'string') return node.objectType;
    if (typeof node.picklistObject === 'string') return node.picklistObject;
    const maps = arr(node.dataTypeMappings).map((d) => d && d.typeValue).filter((v) => typeof v === 'string' && /^[A-Za-z]\w*$/.test(v));
    return maps.length === 1 ? maps[0] : null;
  };
  const walkFlow = (node, ctx, key) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const n of node) walkFlow(n, ctx, key);
      return;
    }
    if (typeof node === 'object') {
      const here = contextObject(node) || ctx;
      for (const [k, v] of Object.entries(node)) if (!SKIP_KEYS.test(k)) walkFlow(v, here, k);
      return;
    }
    const value = String(node);
    for (const t of value.matchAll(/(^|[^.\w$!{])([A-Za-z]\w*__c)\b(?![.\w])/g)) {
      const whole = value.trim() === t[2] || value.trim() === `[${t[2]}]`;
      refs.push({ field: t[2], base: whole && /^(object|objectType|typeValue|picklistObject)$/i.test(key) ? null : ctx, path: [t[2]], how: `${key} do flow`, line: 0, bareString: whole, contextWord: key });
    }
  };
  walkFlow(parsed, null, 'Flow');
  // Process Builder / old flows: a value that is only an object name ([Bundle__c], ObjectType) is the object.
  for (const m of String(raw).matchAll(/<(stringValue|elementReference|leftValueReference|value|objectType|object)>\s*\[?([A-Za-z]\w*__c)\]?\s*<\/\1>/g)) {
    const before = String(raw).slice(Math.max(0, m.index - 200), m.index);
    const name = (/<name>([^<]*)<\/name>(?![\s\S]*<name>)/.exec(before) || [])[1] || m[1];
    refs.push({ field: m[2], base: null, path: [m[2]], how: `valor ${name}`, line: 0, bareString: true, contextWord: /\[/.test(m[0]) ? 'object reference' : name });
  }
  for (const f of arr(parsed.start && parsed.start.filters)) if (f.field && /__c$/i.test(f.field)) refs.push({ field: f.field, base: object, path: [f.field], how: 'critério de entrada', line: 0 });
  // Every merge reference in the XML text: {!$Record.Field__c}, $Record.Parent__r.Field__c, var.Field__c
  for (const m of String(raw).matchAll(/(\$Record(?:__Prior)?|[A-Za-z_]\w*)((?:\.[A-Za-z_]\w*)+)/g)) {
    const parts = m[2].slice(1).split('.');
    if (!/__c$/i.test(parts[parts.length - 1])) continue;
    const head = m[1].toLowerCase();
    const base = names[head] || null;
    if (!base && !/^\$record/.test(head)) {
      // An object name written in full (Account.Score__c) counts as qualified.
      refs.push({ field: parts[parts.length - 1], base: m[1], path: parts, how: `referência ${m[1]}.${parts.join('.')}`, line: 0, qualifiedText: true });
      continue;
    }
    refs.push({ field: parts[parts.length - 1], base, path: parts, how: head.startsWith('$record') ? `${m[1]} (registro do flow)` : `variável ${m[1]}`, line: 0 });
  }
  return dedupe(refs);
}

/* ---------------------------------------------------- LWC, Aura, Visualforce */

/**
 * Field references in a screen component (LWC js/html, Aura cmp/js, Visualforce page/component).
 * Returns { refs, context } where context lists what the component works with (objects, Apex methods/classes),
 * used at query time when a field name alone is not enough.
 */
function uiFieldRefs(kind, text) {
  const refs = [];
  const context = { objects: [], apex: [], controllers: [], types: Object.create(null) };
  // Comments out (same length, so lines stay): /* */, // (not inside a string or a URL), <!-- -->
  const src = String(text)
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/gm, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
  const push = (r) => refs.push(r);
  const add = (list, v) => {
    if (v && !list.includes(v)) list.push(v);
  };

  // Typed things the component declares.
  for (const m of src.matchAll(/@salesforce\/schema\/([\w.]+)/g)) {
    const parts = m[1].split('.');
    add(context.objects, parts[0]);
    if (parts.length > 1 && /__c$/i.test(parts[parts.length - 1])) push({ field: parts[parts.length - 1], base: parts[0], path: parts.slice(1), how: `importa ${m[1]}`, line: lineAt(src, m.index) });
  }
  for (const m of src.matchAll(/@salesforce\/apex\/([\w.]+)/g)) add(context.apex, m[1]);
  for (const m of src.matchAll(/\bobject-?api-?name\s*=\s*["']([\w]+)["']/gi)) add(context.objects, m[1]);
  for (const m of src.matchAll(/objectApiName\s*[:=]\s*['"](\w+)['"]/g)) add(context.objects, m[1]);
  for (const m of src.matchAll(/\b(?:standardController|sObjectType)\s*=\s*["'](\w+)["']/gi)) add(context.objects, m[1]);
  for (const m of src.matchAll(/\b(?:controller|extensions)\s*=\s*["']([\w.,\s]+)["']/gi)) for (const c of m[1].split(',')) add(context.controllers, c.trim());
  // Aura attributes with an sObject type: <aura:attribute name="acc" type="Account"/>
  for (const m of src.matchAll(/<aura:attribute\b[^>]*>/gi)) {
    const name = /\bname\s*=\s*["'](\w+)["']/i.exec(m[0]);
    const type = /\btype\s*=\s*["']([\w.\[\]<>]+)["']/i.exec(m[0]);
    if (name && type) context.types[name[1]] = type[1];
  }

  // Qualified text: 'Account.Score__c' in strings or attributes.
  for (const m of src.matchAll(/["'`]([A-Za-z]\w*)\.([A-Za-z]\w*(?:\.[A-Za-z]\w*)*)["'`]/g)) {
    const parts = m[2].split('.');
    if (!/__c$/i.test(parts[parts.length - 1])) continue;
    push({ field: parts[parts.length - 1], base: m[1], path: parts, how: `texto ${m[1]}.${m[2]}`, line: lineAt(src, m.index), qualifiedText: true });
  }
  // field-name="Score__c" / fieldName="Score__c" inside a form with object-api-name="Account"
  for (const m of src.matchAll(/\b(?:field-name|fieldName|field)\s*=\s*["'](\w+__c)["']/g)) {
    const before = src.slice(0, m.index);
    const forms = [...before.matchAll(/\b(?:object-api-name|objectApiName)\s*=\s*(["'{])\s*!?\s*([\w.]+)/g)];
    const last = forms[forms.length - 1];
    const obj = last && last[1] !== '{' && /^\w+$/.test(last[2]) ? last[2] : null;
    push({ field: m[1], base: obj, path: [m[1]], how: obj ? `campo do formulário de ${obj}` : 'campo de um formulário sem objeto fixo', line: lineAt(src, m.index) });
  }
  // Visualforce / Aura merge fields: {!Account.Score__c}, {!v.acc.Score__c}, {!acc.Score__c}
  for (const m of src.matchAll(/\{!\s*([^}]*)\}/g)) {
    for (const t of m[1].matchAll(/(\$?\b[A-Za-z_]\w*)((?:\.[A-Za-z_]\w*)+)/g)) {
      let parts = t[2].slice(1).split('.');
      // The field can sit in the middle: {!$ObjectType.Account.fields.Score__c.Label}, {!acc.Score__c.format}
      const last = parts.map((x) => /__c$/i.test(x)).lastIndexOf(true);
      if (last < 0) continue;
      parts = parts.slice(0, last + 1);
      let head = t[1];
      let rest = parts;
      if (/^\$(ObjectType|Setup)$/i.test(head)) {
        // $ObjectType.Account.fields.Score__c / $Setup.Settings__c.Field__c
        const names = parts.filter((x) => !/^fields$/i.test(x));
        push({ field: names[names.length - 1], base: names[0], path: names.slice(1), how: `{!${head}.${parts.join('.')}}`, line: lineAt(src, m.index) });
        continue;
      }
      head = head.replace(/^\$/, '');
      if (head === 'v' && rest.length > 1) {
        const type = context.types[rest[0]];
        push({ field: rest[rest.length - 1], base: type ? elementType(type) : null, path: rest.slice(1), how: type ? `atributo ${rest[0]} (${type})` : `atributo ${rest[0]}`, line: lineAt(src, m.index), viaAttribute: rest[0] });
        continue;
      }
      push({ field: rest[rest.length - 1], base: head, path: rest, how: `{!${head}.${rest.join('.')}}`, line: lineAt(src, m.index), mergeHead: head });
    }
  }
  // Everything else: the bare name (record.Score__c, data.Score__c, fields: ['Score__c'])
  const covered = new Set(refs.map((r) => `${r.line}|${r.field}`));
  for (const m of src.matchAll(FIELD_TOKEN)) {
    if (/__r$/i.test(m[1])) continue;
    const after = src[m.index + m[1].length];
    const before = src.slice(Math.max(0, m.index - 40), m.index);
    const prevDot = /\.\s*$/.test(before);
    if (((after === '.' || after === '$') && !prevDot) || /schema\/$/.test(before)) continue; // Object__c.Field__c or an object import
    if (/(object-?api-?name|objectApiName|sobjectType|standardController|objectName|entityName)\s*[=:]\s*["'{]?\s*$/i.test(before)) {
      push({ field: m[1], base: null, path: [m[1]], how: 'nome do objeto na tela', line: lineAt(src, m.index), bareString: true, contextWord: 'objectApiName' });
      continue;
    }
    const line = lineAt(src, m.index);
    if (covered.has(`${line}|${m[1]}`)) continue;
    covered.add(`${line}|${m[1]}`);
    const quoted = /["'`]$/.test(before) && /^["'`]/.test(src[m.index + m[1].length] || '');
    const word = quoted ? (/([A-Za-z_]\w*)\s*(?:=|:|\(|,)\s*["'`]$/.exec(before) || [])[1] || null : null;
    push({ field: m[1], base: null, path: [m[1]], how: 'nome do campo no código da tela', line, contextual: true, bareString: quoted, contextWord: word });
  }
  return { refs: dedupe(refs), context, kind };
}

module.exports = { apexFieldRefs, flowFieldRefs, uiFieldRefs, elementType, declarations, methodBlocks };

/* -------------------------------------------------------------- other metadata */

// Elements whose text is an object, not a field (an object named like a field, Program__c, is not a field use).
const OBJECT_TAGS = /^(object|sobjectType|sObjectType|targetObject|pageOrSobjectType|target|tab|referenceTo|entityName|baseObject|relatedTable|objectType|objectName|sobject|entity|customObject|type|relatedList|relatedObject|parentObject|childObject|lookupObject|sharedTo|recordType|name|reportType|report|fieldSet|layout|compactLayout|listView)$/;

/** The innermost element whose text holds `index`: { tag, start }. */
function tagAt(text, index) {
  const open = text.lastIndexOf('<', index);
  const m = /^<([\w:]+)[^>]*>/.exec(text.slice(open));
  return m ? { tag: m[1].replace(/^\w+:/, ''), start: open } : null;
}

/**
 * The object named next to a field element: <mapping><fieldName>Space__c</fieldName><tab>Market__c</tab></mapping>,
 * <columns><field>X__c</field><table>Contact</table></columns>. Null when the parent has no such child.
 */
function siblingObject(text, t) {
  if (!t) return null;
  // Walk back to the parent's opening tag.
  let depth = 0;
  let i = t.start - 1;
  let parentStart = -1;
  for (; i >= 0; i -= 1) {
    if (text[i] !== '<') continue;
    if (text[i + 1] === '/') depth += 1;
    else if (text[i + 1] !== '?' && text[i + 1] !== '!') {
      const selfClose = /^<[^>]*\/>/.test(text.slice(i, i + 300));
      if (selfClose) continue;
      if (!depth) {
        parentStart = i;
        break;
      }
      depth -= 1;
    }
  }
  if (parentStart < 0) return null;
  const tag = (/^<([\w:]+)/.exec(text.slice(parentStart)) || [])[1];
  if (!tag) return null;
  const close = text.indexOf(`</${tag}>`, t.start);
  if (close < 0) return null;
  const block = text.slice(parentStart, close);
  for (const k of ['tab', 'object', 'sobjectType', 'sObjectType', 'targetObject', 'entity', 'entityName', 'objectType', 'table', 'relatedTable', 'sobject', 'objectName']) {
    const v = childText(block, k);
    if (v && /^[A-Za-z]\w*$/.test(strip(v))) return strip(v);
  }
  return null;
}

/** Text of the first <tag> inside a block. */
function childText(block, tag) {
  const m = new RegExp(`<${tag}>\\s*([^<]*?)\\s*</${tag}>`).exec(block);
  return m ? m[1] : null;
}

/** The block <tag>...</tag> around `index`, or null. */
function blockAround(text, index, tag) {
  const open = text.lastIndexOf(`<${tag}>`, index);
  if (open < 0) return null;
  const close = text.indexOf(`</${tag}>`, open);
  if (close < 0 || close < index) return null;
  return text.slice(open, close);
}

const strip = (v) => String(v || '').replace(/%%%NAMESPACE%%%/g, '').replace(/^\w!/, '');

/**
 * Field references in other metadata (layouts, reports, report types, dashboards, quick actions, record pages,
 * custom metadata records, sharing sets, path assistants, rules...). `file` is the path inside the project.
 */
function metaFieldRefs(file, raw) {
  const text = String(raw).replace(/%%%NAMESPACE%%%/g, '').replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length)).replace(/<(description|inlineHelpText|label|helpText|masterLabel|errorMessage|fullName|developerName)\s*>[\s\S]*?<\/\1\s*>/g, (m) => ' '.repeat(m.length));
  const base = file.split('/').pop();
  const parts = file.split('/');
  const objAt = parts.lastIndexOf('objects');
  const folderObject = objAt >= 0 && parts[objAt + 1] ? parts[objAt + 1] : null;
  const type = (/\.([A-Za-z]+)-meta\.xml$/.exec(base) || [])[1] || '';
  const prefix = base.split('.')[0];
  const top = (tag) => strip(childText(text, tag));
  // The object the file is about, when it has one.
  let fileObject = folderObject;
  if (!fileObject) {
    if (type === 'layout') fileObject = base.split('-')[0];
    else if (type === 'quickAction') fileObject = top('targetObject') || (base.split('.').length > 3 ? prefix : null);
    else if (type === 'flexipage') fileObject = top('sobjectType');
    else if (type === 'pathAssistant') fileObject = top('sobjectType') || top('entityName');
    else if (/^(sharingRules|matchingRules|duplicateRule|workflow|assignmentRules|escalationRules|autoResponseRules|approvalProcess)$/.test(type)) fileObject = prefix;
    else if (type === 'md') fileObject = `${prefix}__mdt`;
    else if (type === 'reportType') fileObject = top('baseObject');
  }
  const refs = [];
  for (const m of text.matchAll(/([A-Za-z_][\w%]*(?:[.$:][A-Za-z_][\w%]*)*)/g)) {
    const chain = strip(m[1]).split(/[.$:]/);
    const field = chain[chain.length - 1];
    if (!/__c$/i.test(field)) continue;
    const line = lineAt(text, m.index);
    const t = tagAt(text, m.index);
    const whole = t && text.slice(text.indexOf('>', t.start) + 1, text.indexOf('<', m.index)).trim() === m[1];
    if (chain.length === 1 && whole && OBJECT_TAGS.test(t.tag)) continue; // an object, not a field
    // A sentence inside metadata (an instruction, a prompt, a help text) is not a use of the field.
    if (t && !whole) {
      const content = text.slice(text.indexOf('>', t.start) + 1, text.indexOf('<', m.index));
      if (/\s\w+\s+\w+\s/.test(content) && !/[=<>!]|\b(AND|OR|NOT|ISBLANK|ISPICKVAL|IF|TEXT)\b|\{!/.test(content)) {
        refs.push({ field, base: null, path: [field], how: 'nome do campo numa frase', line, prose: true });
        continue;
      }
    }
    if (chain.length > 1 && /^(CustomEntity|CustomEntityCustomEntity)$/i.test(chain[0])) continue; // report type of an object
    if (chain.length > 1 && /^FK_?$/i.test(chain[0])) chain.shift(); // FK_$Service__c.Program__c: the lookup's object
    if (chain.length > 1) {
      let head = chain[0];
      let path = chain.slice(1);
      if (/^(Record|\$Record|record)$/.test(head)) head = fileObject;
      else if (/__r$/i.test(head) && fileObject) {
        // Parent__r.Field__c in a field set or layout of the object: the path starts at the file's object
        path = chain;
        head = fileObject;
      }
      if (/^\$Input|^\$/.test(head) && path.length > 1) {
        head = path[0];
        path = path.slice(1);
      }
      refs.push({ field, base: head, path, how: `cita ${chain.join('.')}`, line });
      continue;
    }
    let obj = null;
    let how = '';
    if (type === 'layout' || type === 'reportType' || type === 'report' || type === 'sharingSet' || type === 'md') {
      if (type === 'layout') {
        const rl = blockAround(text, m.index, 'relatedLists');
        if (rl) {
          const list = strip(childText(rl, 'relatedList'));
          obj = list && list.includes('.') ? list.split('.')[0] : null;
          how = obj ? `lista relacionada de ${obj}` : `lista relacionada ${list || ''}`.trim();
        } else {
          obj = fileObject;
          how = 'exibe o campo';
        }
      } else if (type === 'reportType') {
        const col = blockAround(text, m.index, 'columns');
        const table = col ? strip(childText(col, 'table')) : null;
        if (table) {
          const tp = table.split('.');
          refs.push({ field, base: tp[0], path: [...tp.slice(1), field], how: `coluna da tabela ${table}`, line });
          continue;
        }
      } else if (type === 'report') {
        const cf = blockAround(text, m.index, 'crossFilters');
        obj = cf ? strip(childText(cf, 'relatedTable')) : null;
        how = obj ? `filtro cruzado em ${obj}` : 'coluna do relatório';
      } else if (type === 'sharingSet') {
        const am = blockAround(text, m.index, 'accessMappings');
        obj = am ? strip(childText(am, 'object')) : null;
        how = 'mapeamento de acesso';
      } else if (type === 'md') {
        if (t && t.tag === 'field') {
          obj = fileObject;
          how = 'campo do tipo de metadado';
        } else {
          // A value that names a field: the record may say the object in another value.
          refs.push({ field, base: null, path: [field], how: 'valor de um registro de metadado', line, bareString: true, mdObjects: [...text.matchAll(/<value[^>]*>\s*([A-Za-z]\w*)\s*<\/value>/g)].map((x) => strip(x[1])) });
          continue;
        }
      }
    } else if (siblingObject(text, t)) {
      obj = siblingObject(text, t);
      how = `campo de ${obj}`;
    } else if (fileObject) {
      obj = fileObject;
      how = `campo de ${fileObject}`;
    }
    // <componentInstanceProperties><name>entityNames</name> ... <value>X__c</value>: the property says what X is
    const prop = whole ? blockAround(text, m.index, 'componentInstanceProperties') : null;
    const contextWord = prop ? childText(prop, 'name') : t ? t.tag : null;
    refs.push({ field, base: obj ? strip(obj) : null, path: [field], how: how || 'cita um campo com esse nome', line, bareString: Boolean(whole), contextWord });
  }
  return dedupe(refs);
}

module.exports.metaFieldRefs = metaFieldRefs;
