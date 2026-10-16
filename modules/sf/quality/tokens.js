'use strict';

/**
 * Apex tokenizer for duplicate detection. Comments are dropped; string and number literals become
 * placeholders, so two blocks that differ only in a message or a number still count as copies.
 */
const TOKEN_RE = /'(?:\\.|[^'\\])*'|\d+(?:\.\d+)?|[A-Za-z_]\w*|==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|=>|[{}()[\];,.<>=+\-*/!?:&|]/g;

/** Blanks out comments (keeping line breaks and offsets) without touching string literals. */
function stripComments(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== "'" && source[j] !== '\n') j += source[j] === '\\' ? 2 : 1;
      out += source.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && source[i + 1] === '/') {
      let j = source.indexOf('\n', i);
      if (j < 0) j = source.length;
      out += ' '.repeat(j - i);
      i = j;
    } else if (c === '/' && source[i + 1] === '*') {
      let j = source.indexOf('*/', i + 2);
      j = j < 0 ? source.length : j + 2;
      out += source.slice(i, j).replace(/[^\n]/g, ' ');
      i = j;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

function tokenize(source) {
  const tokens = [];
  const lines = source.split('\n');
  const noComments = stripComments(source);
  let line = 1;
  let last = 0;
  for (const m of noComments.matchAll(TOKEN_RE)) {
    for (let i = last; i < m.index; i += 1) if (noComments[i] === '\n') line += 1;
    last = m.index;
    const raw = m[0];
    const value = raw.startsWith("'") ? '<str>' : /^\d/.test(raw) ? '<num>' : raw.toLowerCase();
    tokens.push({ value, line });
  }
  return { tokens, lineCount: lines.length };
}

/** FNV-1a hash of a window of token values. */
function hashWindow(tokens, start, size) {
  let h = 2166136261;
  for (let i = start; i < start + size; i += 1) {
    const v = tokens[i].value;
    for (let j = 0; j < v.length; j += 1) {
      h ^= v.charCodeAt(j);
      h = Math.imul(h, 16777619);
    }
    h ^= 31;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

module.exports = { stripComments, tokenize, hashWindow };
