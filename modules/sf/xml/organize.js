'use strict';

const { RULES } = require('./rules');

/**
 * Splits the inner XML of an element into top-level child blocks, keeping the exact original text.
 * Each block: { tag, text } where text includes the leading whitespace. Comments stay attached.
 */
function splitChildren(inner) {
  const blocks = [];
  let i = 0;
  let pending = '';
  while (i < inner.length) {
    const lt = inner.indexOf('<', i);
    if (lt < 0) {
      pending += inner.slice(i);
      break;
    }
    pending += inner.slice(i, lt);
    if (inner.startsWith('<!--', lt)) {
      const end = inner.indexOf('-->', lt) + 3;
      pending += inner.slice(lt, end);
      i = end;
      continue;
    }
    const nameMatch = /^<([\w:.-]+)/.exec(inner.slice(lt));
    if (!nameMatch) throw new Error(`XML inesperado perto de: ${inner.slice(lt, lt + 40)}`);
    const tag = nameMatch[1];
    const openEnd = inner.indexOf('>', lt);
    if (inner[openEnd - 1] === '/') {
      blocks.push({ tag, text: pending + inner.slice(lt, openEnd + 1) });
      pending = '';
      i = openEnd + 1;
      continue;
    }
    let depth = 1;
    let j = openEnd + 1;
    const re = new RegExp(`<(/?)${tag.replace(/[.]/g, '\\.')}(?=[\\s>/])[^>]*?(/?)>`, 'g');
    re.lastIndex = j;
    let m;
    while (depth > 0 && (m = re.exec(inner))) {
      if (m[2] === '/') continue;
      depth += m[1] === '/' ? -1 : 1;
      j = re.lastIndex;
    }
    if (depth !== 0) throw new Error(`Elemento <${tag}> sem fechamento`);
    blocks.push({ tag, text: pending + inner.slice(lt, j) });
    pending = '';
    i = j;
  }
  return { blocks, tail: pending };
}

function childValue(text, tag) {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(text);
  return m ? m[1].trim() : '';
}

/** Content of a block without whitespace differences, to compare duplicates. */
function canonical(text) {
  return text.replace(/>\s+</g, '><').trim();
}

/** Ordinal comparison (character codes), the order Salesforce uses when it retrieves metadata. */
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function keyOf(block, keyTags) {
  return keyTags.map((t) => childValue(block.text, t)).join('|');
}

/** package.xml: sort and dedupe <members> inside each <types>. */
function organizePackageTypes(text, report) {
  return text.replace(/(<types>)([\s\S]*?)(\n?\s*<name>[\s\S]*?<\/name>)/, (all, open, membersText, nameText) => {
    const members = [...membersText.matchAll(/(\s*)<members>([\s\S]*?)<\/members>/g)];
    if (!members.length) return all;
    const indent = members[0][1];
    const values = members.map((m) => m[2].trim());
    const uniq = [...new Set(values)];
    report.duplicates += values.length - uniq.length;
    const sorted = [...uniq].sort((a, b) => (a === '*' ? -1 : b === '*' ? 1 : compare(a, b)));
    if (sorted.join() !== values.join()) report.sorted += 1;
    return open + sorted.map((v) => `${indent}<members>${v}</members>`).join('') + nameText;
  });
}

/**
 * Organizes one metadata XML file. Returns { text, changed, report }.
 * Only sections listed in the rules are touched; everything else keeps its exact text.
 * Duplicates with the same key and the same content are removed; same key with different content is a conflict
 * and is left untouched for a person to decide.
 */
function organizeXml(xml) {
  const rootMatch = /<([A-Za-z]+)\b[^>]*xmlns="http:\/\/soap\.sforce\.com\/2006\/04\/metadata"[^>]*>/.exec(xml);
  const report = { type: rootMatch ? rootMatch[1] : null, duplicates: 0, sorted: 0, conflicts: [] };
  if (!rootMatch || !RULES[report.type]) return { text: xml, changed: false, report, supported: false };
  const rule = RULES[report.type];
  const start = rootMatch.index + rootMatch[0].length;
  const end = xml.lastIndexOf(`</${report.type}>`);
  const { blocks, tail } = splitChildren(xml.slice(start, end));

  const groups = new Map();
  for (const b of blocks) {
    if (!groups.has(b.tag)) groups.set(b.tag, []);
    groups.get(b.tag).push(b);
  }

  for (const [tag, list] of groups) {
    const keyTags = rule.sections[tag];
    if (!keyTags) continue;
    if (rule.packageXml) for (const b of list) b.text = organizePackageTypes(b.text, report);
    const byKey = new Map();
    const kept = [];
    for (const b of list) {
      const key = keyOf(b, keyTags);
      if (!key.replace(/\|/g, '')) {
        kept.push(b);
        continue;
      }
      const seen = byKey.get(key);
      if (!seen) {
        byKey.set(key, b);
        kept.push(b);
      } else if (canonical(seen.text) === canonical(b.text)) {
        report.duplicates += 1;
      } else {
        if (!report.conflicts.some((c) => c.section === tag && c.key === key)) report.conflicts.push({ section: tag, key });
        kept.push(b);
      }
    }
    if (rule.sort) {
      const before = kept.map((b) => keyOf(b, keyTags)).join('\n');
      kept.sort((a, b) => compare(keyOf(a, keyTags), keyOf(b, keyTags)));
      if (kept.map((b) => keyOf(b, keyTags)).join('\n') !== before) report.sorted += 1;
    }
    groups.set(tag, kept);
  }

  let order = [...groups.keys()];
  if (rule.sortSections) {
    const sortedOrder = [...order].sort(compare);
    if (sortedOrder.join() !== order.join()) report.sorted += 1;
    order = sortedOrder;
  }
  const leading = blocks.length ? blocks[0].text.match(/^\s*/)[0] : '\n    ';
  const body = order
    .flatMap((tag) => groups.get(tag))
    .map((b) => leading + b.text.replace(/^\s*/, ''))
    .join('');
  const text = xml.slice(0, start) + body + tail + xml.slice(end);
  return { text, changed: text !== xml, report, supported: true };
}

module.exports = { organizeXml, splitChildren };
