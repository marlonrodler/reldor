'use strict';

/**
 * Repetition only the index can see: SOQL repeated or outside the fflib selector, methods that already exist,
 * and messages repeated across classes.
 */
const { stripApex, blockAfter } = require('../indexer/apex');
const { tokenize, stripComments } = require('./tokens');

const codeCache = new WeakMap();
/** Source without comments (same offsets, so line numbers stay right). */
function codeOf(s) {
  if (!codeCache.has(s)) codeCache.set(s, stripComments(s.text));
  return codeCache.get(s);
}

const COMMON_METHODS = new Set([
  'execute', 'start', 'finish', 'run', 'call', 'invoke', 'tostring', 'equals', 'hashcode', 'compareto', 'handle', 'process',
  'construct', 'newinstance', 'getsobjecttype', 'getsobjectfieldlist', 'getorderby', 'init', 'setup', 'main', 'validate',
]);

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function normalizeSoql(q) {
  return q
    .toLowerCase()
    .replace(/:\s*[\w.]+/g, ':?')
    .replace(/'(?:\\.|[^'\\])*'/g, "'?'")
    .replace(/\b\d+\b/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Inline SOQL with its normalized text and line. */
function soqlOf(text) {
  const out = [];
  for (const m of text.matchAll(/\[\s*(SELECT\s[\s\S]*?)\]/gi)) {
    const obj = /\bFROM\s+(\w+)/i.exec(m[1]);
    out.push({ text: normalizeSoql(m[1]), object: obj ? obj[1] : null, line: lineAt(text, m.index) });
  }
  return out;
}

/** Method declarations: { name, params (types), line, bodyTokens }. */
function methodsOf(text) {
  const { code } = stripApex(text);
  const out = [];
  const re = /\b(?:(?:public|private|protected|global|static|override|virtual)\s+)+([\w<>,.\s]+?)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let m;
  while ((m = re.exec(code))) {
    const params = m[3].trim() ? m[3].split(',').map((p) => p.trim().split(/\s+/).slice(0, -1).join(' ').toLowerCase()) : [];
    const body = blockAfter(code, m.index);
    out.push({ name: m[2], returns: m[1].trim(), params, line: lineAt(code, m.index), bodyTokens: tokenize(body).tokens.map((t) => t.value), override: /\boverride\b/.test(m[0]) });
  }
  return out;
}

function shingles(values, k = 5) {
  const set = new Set();
  for (let i = 0; i + k <= values.length; i += 1) set.add(values.slice(i, i + k).join(' '));
  return set;
}

function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/**
 * sources: Map(file -> { text, className, isTest, isSelector }); changed: Map(file -> Set(added lines) | null).
 * model: the index (for selectors per object).
 */
/** Interfaces and base classes in the class header, lowercased. */
function basesOf(text) {
  const head = (text.match(/\bclass\s+\w+([^{]*)\{/i) || [])[1] || '';
  return new Set((head.match(/\b(?:extends|implements)\s+([\w.,\s<>]+)/gi) || []).flatMap((x) => x.replace(/^(extends|implements)\s+/i, '').split(',')).map((x) => x.replace(/<.*$/, '').trim().toLowerCase()).filter(Boolean));
}

function findRepetition(sources, changed, model, options = {}) {
  const findings = [];
  const touches = (added, line, span = 1) => !added || [...Array(span).keys()].some((k) => added.has(line + k));

  // SOQL
  const soqlIndex = new Map();
  for (const [file, s] of sources) {
    if (s.isTest) continue;
    for (const q of soqlOf(codeOf(s))) {
      if (!soqlIndex.has(q.text)) soqlIndex.set(q.text, []);
      soqlIndex.get(q.text).push({ file, className: s.className, line: q.line, isSelector: s.isSelector });
    }
  }
  for (const [file, added] of changed) {
    const s = sources.get(file);
    if (!s || s.isTest || s.isSelector) continue;
    for (const q of soqlOf(codeOf(s))) {
      if (!touches(added, q.line)) continue;
      const elsewhere = (soqlIndex.get(q.text) || []).filter((o) => o.file !== file);
      const selector = q.object ? (model.objects[q.object]?.selectors || [])[0] : null;
      if (elsewhere.length) {
        findings.push({ kind: 'soql-repetida', severity: 'média', file, line: q.line, message: `Esta query já existe em ${[...new Set(elsewhere.map((o) => o.className))].join(', ')}.`, fix: selector ? `Coloque a query no ${selector} e use o método dele nos dois lugares.` : 'Extraia a query para um método compartilhado (um Selector, se o projeto usar fflib).' });
      } else if (selector) {
        findings.push({ kind: 'soql-fora-do-selector', severity: 'baixa', file, line: q.line, message: `Query em ${q.object} fora do ${selector}.`, fix: `No padrão fflib, consultas de ${q.object} ficam no ${selector}. Veja se um método dele já atende.` });
      }
    }
  }

  // Methods that already exist
  const methodIndex = [];
  for (const [file, s] of sources) {
    if (s.isTest) continue;
    for (const m of methodsOf(codeOf(s))) methodIndex.push({ ...m, file, className: s.className, shingles: shingles(m.bodyTokens) });
  }
  for (const [file, added] of changed) {
    const s = sources.get(file);
    if (!s || s.isTest) continue;
    for (const m of methodIndex.filter((x) => x.file === file)) {
      if (m.override || COMMON_METHODS.has(m.name.toLowerCase()) || !touches(added, m.line)) continue;
      // Same name + same parameters + similar body. Classes that share a contract (same interface or base
      // class, or two Selectors) are expected to repeat signatures, so they are left out.
      const mine = basesOf(codeOf(s));
      const sameSignature = methodIndex.filter((o) => o.file !== file && o.name.toLowerCase() === m.name.toLowerCase() && o.params.join(',') === m.params.join(',') && !o.override
        && !(s.isSelector && sources.get(o.file).isSelector)
        && ![...basesOf(codeOf(sources.get(o.file)))].some((x) => mine.has(x))
        && similarity(m.shingles, o.shingles) >= 0.5);
      if (sameSignature.length) {
        findings.push({ kind: 'metodo-ja-existe', severity: 'média', file, line: m.line, message: `${m.name}(${m.params.join(', ')}) já existe em ${sameSignature.map((o) => o.className).join(', ')}.`, fix: 'Reaproveite o método existente, ou junte os dois num lugar só.' });
        continue;
      }
      if (m.bodyTokens.length < (options.minMethodTokens || 40)) continue;
      const similar = methodIndex
        .filter((o) => o.file !== file && o.bodyTokens.length >= m.bodyTokens.length * 0.7 && o.bodyTokens.length <= m.bodyTokens.length * 1.3)
        .map((o) => ({ o, score: similarity(m.shingles, o.shingles) }))
        .filter((x) => x.score >= (options.similarity || 0.8))
        .sort((a, b) => b.score - a.score)[0];
      if (similar) {
        findings.push({ kind: 'metodo-parecido', severity: 'baixa', file, line: m.line, message: `${m.name} é ${Math.round(similar.score * 100)}% parecido com ${similar.o.className}.${similar.o.name}.`, fix: 'Veja se dá para reaproveitar ou generalizar o método existente.' });
      }
    }
  }

  // Repeated messages
  const literalIndex = new Map();
  for (const [file, s] of sources) {
    if (s.isTest) continue;
    for (const m of codeOf(s).matchAll(/'((?:\\.|[^'\\]){15,})'/g)) {
      const value = m[1];
      if (!/\s/.test(value) || /^\s*SELECT\b/i.test(value)) continue;
      if (!literalIndex.has(value)) literalIndex.set(value, new Map());
      if (!literalIndex.get(value).has(file)) literalIndex.get(value).set(file, lineAt(codeOf(s), m.index));
    }
  }
  for (const [value, files] of literalIndex) {
    if (files.size < (options.minLiteralFiles || 3)) continue;
    for (const [file, added] of changed) {
      if (!files.has(file) || !touches(added, files.get(file))) continue;
      findings.push({ kind: 'texto-repetido', severity: 'baixa', file, line: files.get(file), message: `O texto "${value.slice(0, 60)}${value.length > 60 ? '…' : ''}" aparece em ${files.size} classes.`, fix: 'Use um Custom Label: uma tradução, um lugar para mudar.' });
    }
  }
  return findings;
}

module.exports = { findRepetition, soqlOf, methodsOf, normalizeSoql };
