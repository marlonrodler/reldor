'use strict';

/**
 * Second pass for "where is this field used": files the index does not model in detail.
 * - Any metadata XML that names Object.Field (reports, report types, field sets, dashboards, quick actions,
 *   record pages, prompt templates, related lists in layouts of other objects...): certo.
 * - XML inside the object's own folder that lists the field by name (field sets, list views, record types): certo.
 * - LWC, Aura and Visualforce that use the field by name in code, without an import: provável (name only).
 * - Apex that has the field name only inside a text string (dynamic SOQL, field lists): possível.
 */
const fs = require('node:fs');
const path = require('node:path');

const TYPE_LABEL = {
  report: 'Report', reportType: 'Report type', dashboard: 'Dashboard', fieldSet: 'Field set', quickAction: 'Quick action',
  flexipage: 'Página (FlexiPage)', layout: 'Layout', listView: 'List view', compactLayout: 'Compact layout', recordType: 'Record type',
  genAiPromptTemplate: 'Prompt template', genAiFunction: 'Ação de agente', flow: 'Flow', permissionset: 'Permission set', profile: 'Profile',
  pathAssistant: 'Path', app: 'App', sharingRules: 'Sharing rule', md: 'Custom metadata', webLink: 'Botão/link', email: 'E-mail template',
  matchingRule: 'Matching rule', duplicateRule: 'Duplicate rule', assignmentRules: 'Regra de atribuição', escalationRules: 'Regra de escalonamento',
};

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '__tests__' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function componentOf(rel) {
  let m;
  if ((m = /\/lwc\/([^/]+)\//.exec(rel))) return { where: 'LWC', name: m[1], code: true };
  if ((m = /\/aura\/([^/]+)\//.exec(rel))) return { where: 'Aura', name: m[1], code: true };
  if ((m = /\/([^/]+)\.(page|component)$/.exec(rel))) return { where: 'Visualforce', name: m[1], code: true };
  if ((m = /\/([^/]+)\.cls$/.exec(rel))) return { where: 'Apex', name: m[1], apex: true };
  if ((m = /\/objects\/([^/]+)\/([^/]+)\/([^/]+)\.([A-Za-z]+)-meta\.xml$/.exec(rel))) return { where: TYPE_LABEL[m[4]] || m[4], name: `${m[1]}.${m[3]}`, xml: true, inObject: m[1], type: m[4] };
  if ((m = /\/([^/]+)\.([A-Za-z]+)-meta\.xml$/.exec(rel))) return { where: TYPE_LABEL[m[2]] || m[2], name: m[1], xml: true, type: m[2] };
  return null;
}

/**
 * sweepFieldUsages(root, packageDirectories, object, field, known) -> extra hits, skipping components already
 * in `known` (names, lowercase).
 */
function sweepFieldUsages(root, packageDirectories, object, field, known = new Set()) {
  const hits = [];
  const qualified = object ? new RegExp(`\\b${escape(object)}\\.${escape(field)}\\b`, 'i') : null;
  const byName = new RegExp(`\\b${escape(field)}\\b`, 'i');
  const inString = new RegExp(`'[^'\\n]*\\b${escape(field)}\\b[^'\\n]*'`, 'i');
  const seen = new Set();
  for (const full of packageDirectories.flatMap((d) => walk(path.join(root, d)))) {
    const rel = `/${path.relative(root, full).split(path.sep).join('/')}`;
    const c = componentOf(rel);
    if (!c) continue;
    if (c.type === 'field' || c.type === 'object' || /Translation$/.test(c.type || '') || c.type === 'translation') continue;
    if (c.xml && c.inObject && object && c.inObject.toLowerCase() === object.toLowerCase() && /^(field|validationRule|webLink)$/.test(c.type)) continue;
    const key = `${c.where}|${c.name}`.toLowerCase();
    if (seen.has(key) || known.has(c.name.toLowerCase()) || [...known].some((k) => k.endsWith(`.${c.name.toLowerCase()}`) || k === c.name.split('.').pop().toLowerCase())) continue;
    if (!/\.(xml|js|html|cmp|page|component|cls)$/.test(full)) continue;
    let text;
    try {
      text = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    if (!byName.test(text)) continue;
    let hit = null;
    if (c.xml) {
      if (qualified && qualified.test(text)) hit = { where: c.where, name: c.name, how: `cita ${object}.${field}`, certainty: 'certo' };
      else if (object && c.inObject && c.inObject.toLowerCase() === object.toLowerCase()) hit = { where: c.where, name: c.name, how: 'lista o campo', certainty: 'certo' };
      else if (!object) hit = { where: c.where, name: c.name, how: 'cita um campo com esse nome', certainty: 'provável' };
    } else if (c.code) {
      hit = { where: c.where, name: c.name, how: 'usa um campo com esse nome no código', certainty: 'provável' };
    } else if (c.apex && inString.test(require('../indexer/apex').stripApexComments(text))) {
      hit = { where: 'Apex', name: c.name, how: 'nome do campo em texto (SOQL dinâmica ou lista de campos)', certainty: 'possível' };
    }
    if (hit) {
      seen.add(key);
      hits.push(hit);
    }
  }
  return hits;
}

module.exports = { sweepFieldUsages };
