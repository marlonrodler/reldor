'use strict';

const { git } = require('./index');

/**
 * Line merge with the team's rule: keep what the target already has and apply only our change.
 *
 * Git's merge stops whenever two changes touch the same lines or lines that are next to each other. Here each
 * side's change is taken as a list of edits on the common base, and edits are combined at the line level:
 * - edits that do not overlap are both applied, even when they are next to each other;
 * - two insertions at the same spot keep both: the target's first, then ours;
 * - the same edit on both sides is applied once;
 * - only when both sides changed the same base lines differently is it a real conflict.
 */

/** Stores text as a blob and returns its id (so `git diff` can compare any two texts). */
function blobOf(root, text) {
  const r = git(root, ['hash-object', '-w', '--stdin'], { input: text });
  return r.stdout;
}

const splitLines = (text) => {
  if (!text) return [];
  const rows = text.replace(/\r\n/g, '\n').split('\n');
  if (rows[rows.length - 1] === '') rows.pop();
  return rows;
};

/** Edits from base to other, from `git diff -U0`: [{ s, e, lines }] in 0-based half-open base ranges. */
function editsBetween(root, baseBlob, otherBlob) {
  const out = [];
  const diff = git(root, ['diff', '-U0', '--no-color', '--no-ext-diff', '--diff-algorithm=histogram', baseBlob, otherBlob], { raw: true });
  let current = null;
  for (const row of (diff.stdout || '').split('\n')) {
    const h = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/.exec(row);
    if (h) {
      const a = Number(h[1]);
      const b = h[2] === undefined ? 1 : Number(h[2]);
      current = b === 0 ? { s: a, e: a, lines: [] } : { s: a - 1, e: a - 1 + b, lines: [] };
      out.push(current);
    } else if (current && row.startsWith('+') && !row.startsWith('+++')) {
      current.lines.push(row.slice(1).replace(/\r$/, ''));
    }
  }
  return out;
}

const overlaps = (x, y) => {
  if (x.s === x.e && y.s === y.e) return x.s === y.s; // two insertions at the same spot
  if (x.s === x.e) return y.s < x.s && x.s < y.e; // insertion strictly inside a replaced range
  if (y.s === y.e) return x.s < y.s && y.s < x.e;
  return x.s < y.e && y.s < x.e;
};

/** Base lines [s, e) with one side's edits applied. */
function applyEdits(base, s, e, edits) {
  const out = [];
  let at = s;
  for (const ed of edits) {
    out.push(...base.slice(at, ed.s), ...ed.lines);
    at = ed.e;
  }
  out.push(...base.slice(at, e));
  return out;
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * merge3(root, base, target, ours) -> { text, conflicts: [{ line, base, target, ours }], resolved: n }
 * resolved counts the places where Git would have stopped but the rule decided.
 */
function merge3(root, baseText, targetText, oursText, { targetLabel = 'destino', oursLabel = 'sua branch' } = {}) {
  const base = splitLines(baseText);
  const baseBlob = blobOf(root, baseText || '');
  const T = editsBetween(root, baseBlob, blobOf(root, targetText || '')).map((x) => ({ ...x, side: 'T' }));
  const O = editsBetween(root, baseBlob, blobOf(root, oursText || '')).map((x) => ({ ...x, side: 'O' }));
  const all = [...T, ...O].sort((a, b) => a.s - b.s || a.e - b.e || (a.side === 'T' ? -1 : 1));

  // Clusters of edits that overlap each other.
  const clusters = [];
  for (const ed of all) {
    const last = clusters[clusters.length - 1];
    if (last && last.edits.some((x) => overlaps(x, ed))) {
      last.edits.push(ed);
      last.s = Math.min(last.s, ed.s);
      last.e = Math.max(last.e, ed.e);
    } else {
      clusters.push({ s: ed.s, e: ed.e, edits: [ed] });
    }
  }

  const result = [];
  const conflicts = [];
  let resolved = 0;
  let at = 0;
  for (const c of clusters) {
    result.push(...base.slice(at, c.s));
    const t = c.edits.filter((x) => x.side === 'T');
    const o = c.edits.filter((x) => x.side === 'O');
    if (!t.length || !o.length) {
      result.push(...applyEdits(base, c.s, c.e, c.edits));
    } else {
      const tv = applyEdits(base, c.s, c.e, t);
      const ov = applyEdits(base, c.s, c.e, o);
      const allInsert = c.edits.every((x) => x.s === x.e);
      if (same(tv, ov)) {
        result.push(...tv);
      } else if (allInsert) {
        // Both added at the same spot: keep what the target has, then add ours.
        result.push(...tv, ...ov);
        resolved += 1;
      } else {
        conflicts.push({ line: result.length + 1, base: base.slice(c.s, c.e), target: tv, ours: ov });
        result.push(`<<<<<<< ${targetLabel}`, ...tv, '=======', ...ov, `>>>>>>> ${oursLabel}`);
      }
    }
    at = c.e;
  }
  result.push(...base.slice(at));

  const eol = /\r\n/.test(targetText || oursText || '') ? '\r\n' : '\n';
  const trailing = /\n$/.test(targetText || oursText || '\n');
  return { text: result.join(eol) + (trailing && result.length ? eol : ''), conflicts, resolved };
}

module.exports = { merge3, editsBetween, splitLines, blobOf };
