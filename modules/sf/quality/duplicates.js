'use strict';

/**
 * Copy-paste detection: blocks of at least `minTokens` identical tokens shared between a changed file
 * and any other place in the project. Only blocks that touch lines you added are reported.
 */
const { hashWindow } = require('./tokens');

function findDuplicateBlocks(sources, changed, options = {}) {
  const window = options.minTokens || 60;
  const minLines = options.minLines || 6;
  const index = new Map();
  for (const [file, { tokens }] of sources) {
    for (let i = 0; i + window <= tokens.length; i += 1) {
      const h = hashWindow(tokens, i, window);
      if (!index.has(h)) index.set(h, []);
      index.get(h).push({ file, at: i });
    }
  }

  const blocks = [];
  const seen = new Set();
  for (const [file, added] of changed) {
    const src = sources.get(file);
    if (!src) continue;
    const { tokens } = src;
    let i = 0;
    while (i + window <= tokens.length) {
      const h = hashWindow(tokens, i, window);
      const others = (index.get(h) || []).filter((o) => o.file !== file || Math.abs(o.at - i) >= window);
      if (!others.length) {
        i += 1;
        continue;
      }
      const other = others[0];
      const otherTokens = sources.get(other.file).tokens;
      let len = window;
      // In the same file the copy cannot run into its own original.
      const cap = other.file === file ? Math.abs(other.at - i) : Infinity;
      while (len < cap && i + len < tokens.length && other.at + len < otherTokens.length && tokens[i + len].value === otherTokens[other.at + len].value) len += 1;
      const from = tokens[i].line;
      const to = tokens[i + len - 1].line;
      const touchesAdded = !added || [...Array(to - from + 1).keys()].some((k) => added.has(from + k));
      const otherFrom = otherTokens[other.at].line;
      const key = [file, from, other.file, otherFrom].join('|');
      const reverse = [other.file, otherFrom, file, from].join('|');
      if (to - from + 1 >= minLines && touchesAdded && !seen.has(reverse)) {
        seen.add(key);
        blocks.push({
          file,
          from,
          to,
          other: other.file,
          otherFrom,
          otherTo: otherTokens[other.at + len - 1].line,
          tokens: len,
          places: new Set(others.map((o) => o.file)).size + 1,
        });
      }
      i += len;
    }
  }
  return blocks;
}

module.exports = { findDuplicateBlocks };
