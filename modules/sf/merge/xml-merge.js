'use strict';

const { RULES } = require('../xml/rules');
const { organizeXml, splitChildren } = require('../xml/organize');

/**
 * Three-way merge of Salesforce metadata XML, item by item.
 *
 * Git compares lines, so two people adding different classes to the same profile "conflict" just because the
 * lines are next to each other. Here each entry (a classAccess, a fieldPermission, a label...) is compared on its
 * own: if only one side changed it, that side wins; if both changed it the same way, fine; only when both changed
 * the same entry differently is it a real conflict, and only that entry gets conflict markers.
 */

const ROOT_RE = /<([A-Za-z]+)\b[^>]*xmlns="http:\/\/soap\.sforce\.com\/2006\/04\/metadata"[^>]*>/;

function childValue(text, tag) {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(text);
  return m ? m[1].trim() : '';
}

const canonical = (text) => text.replace(/>\s+</g, '><').trim();

/** Parses a file into { type, head, tail, items: [{ key, tag, text }] } or null when unsupported. */
function parse(xml) {
  const root = ROOT_RE.exec(xml);
  if (!root || !RULES[root[1]]) return null;
  const type = root[1];
  const rule = RULES[type];
  const start = root.index + root[0].length;
  const end = xml.lastIndexOf(`</${type}>`);
  if (end < start) return null;
  const { blocks, tail } = splitChildren(xml.slice(start, end));
  const counts = new Map();
  const items = blocks.map((b) => {
    const keyTags = rule.sections[b.tag];
    let key = keyTags ? `${b.tag}#${keyTags.map((t) => childValue(b.text, t)).join('|')}` : null;
    if (!key || !key.replace(/^[^#]*#/, '').replace(/\|/g, '')) {
      // Single elements (description, label, userLicense...) are keyed by tag and position.
      const n = (counts.get(b.tag) || 0) + 1;
      counts.set(b.tag, n);
      key = `${b.tag}@${n}`;
    }
    return { key, tag: b.tag, text: b.text.replace(/^\s*/, '') };
  });
  return { type, rule, head: xml.slice(0, start), tail: tail + xml.slice(end), items, indent: blocks.length ? blocks[0].text.match(/^\s*/)[0] : '\n    ' };
}

/** "Account.CPF__c" style label for a key, for messages. */
function describe(key) {
  const [section, id] = key.split(/[#@]/);
  return { section, key: key.includes('#') ? id : section };
}

/**
 * mergeXml(base, ours, theirs) -> { supported, text, conflicts: [{ section, key }], merged: n }
 * base may be '' (file added on both sides).
 */
function mergeXml(base, ours, theirs, { oursLabel = 'ours', theirsLabel = 'theirs' } = {}) {
  const o = parse(ours);
  const t = parse(theirs);
  const b = base ? parse(base) : { items: [] };
  if (!o || !t || !b || o.type !== t.type) return { supported: false };

  const map = (p) => new Map(p.items.map((i) => [i.key, i]));
  const B = map(b);
  const O = map(o);
  const T = map(t);
  const same = (x, y) => (x ? canonical(x.text) : null) === (y ? canonical(y.text) : null);

  const result = new Map();
  const conflicts = [];
  const conflictKeys = new Set();
  let merged = 0;
  for (const key of new Set([...O.keys(), ...T.keys(), ...B.keys()])) {
    const bi = B.get(key);
    const oi = O.get(key);
    const ti = T.get(key);
    if (same(oi, ti)) {
      if (oi) result.set(key, oi.text);
    } else if (same(oi, bi)) {
      if (ti) result.set(key, ti.text);
      merged += 1;
    } else if (same(ti, bi)) {
      if (oi) result.set(key, oi.text);
    } else {
      conflicts.push(describe(key));
      const pad = o.indent.replace(/^\r?\n/, '');
      const side = (i) => (i ? `${pad}${i.text}\n` : '');
      result.set(key, `\n<<<<<<< ${oursLabel}\n${side(oi)}=======\n${side(ti)}>>>>>>> ${theirsLabel}`);
      conflictKeys.add(key);
    }
  }

  // Order: ours first; entries that only theirs has go right after their neighbour in theirs.
  const order = o.items.map((i) => i.key).filter((k) => result.has(k));
  const theirsOrder = t.items.map((i) => i.key);
  theirsOrder.forEach((k, idx) => {
    if (!result.has(k) || order.includes(k)) return;
    let at = -1;
    for (let p = idx - 1; p >= 0 && at < 0; p -= 1) at = order.indexOf(theirsOrder[p]);
    if (at < 0) {
      const tag = k.split(/[#@]/)[0];
      const firstSameTag = order.findIndex((x) => x.split(/[#@]/)[0] === tag);
      order.splice(firstSameTag < 0 ? order.length : firstSameTag, 0, k);
    } else {
      order.splice(at + 1, 0, k);
    }
  });

  let text = o.head + order.map((k) => (conflictKeys.has(k) ? '' : o.indent) + result.get(k)).join('') + o.tail;
  // Sorted types are put back in the Salesforce order (not when there are markers: keep them readable).
  if (!conflicts.length && o.rule.sort) text = organizeXml(text).text;
  if (/\r\n/.test(ours)) text = text.replace(/\r?\n/g, '\r\n');
  return { supported: true, text, conflicts, merged };
}

module.exports = { mergeXml };
