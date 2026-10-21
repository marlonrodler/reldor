'use strict';

/**
 * "It already exists, but is it enabled?" For a field (and optionally one picklist value), an object, a record type or
 * an Apex class: every place in the project's metadata that has to allow it, and where it is missing. Picklist value in
 * the field / global value set (active?), dependent picklist, record types and business processes, field permissions in
 * profiles and permission sets, layouts and the layout of each record type, record pages, path, translations, and rules
 * or code that list the other values of the picklist but not this one.
 * Reads the XML files directly (regex on big ones), so it is fast and always current. Facts only, no org.
 */
const fs = require('node:fs');
const path = require('node:path');
const { parseXml, arr, bool } = require('../indexer/xml');

const SKIP = new Set(['node_modules', '.git', '.sfdx', '.sf', '.reldor']);

/** All files under the package folders, grouped by metadata suffix ("profile", "permissionset", "layout"...). */
function projectFiles(root) {
  const { readProject } = require('../index');
  const dirs = (readProject(root)?.packageDirectories || ['force-app']).map((d) => path.join(root, d));
  const byType = {};
  const stack = dirs.filter((d) => fs.existsSync(d));
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        stack.push(full);
        continue;
      }
      const m = /\.([A-Za-z]+)-meta\.xml$/.exec(e.name);
      const type = m ? m[1] : path.extname(e.name).slice(1);
      (byType[type] || (byType[type] = [])).push(full);
    }
  }
  return byType;
}

const read = (f) => {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};
const rel = (root, f) => path.relative(root, f).split(path.sep).join('/');
const baseName = (f, suffix) => path.basename(f).replace(`.${suffix}-meta.xml`, '');
const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const blocks = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1]);
const decode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const tagOf = (block, tag) => (new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(block) || [])[1] || null;

/** Profiles and permission sets: name, kind, file and text. */
function permissionFiles(root, files) {
  return [
    ...(files.profile || []).map((f) => ({ kind: 'Profile', name: baseName(f, 'profile'), file: rel(root, f), xml: read(f) })),
    ...(files.permissionset || []).map((f) => ({ kind: 'Permission set', name: baseName(f, 'permissionset'), file: rel(root, f), xml: read(f) })),
  ];
}

/** The picklist values of a field: its own value set or the global value set it points to. */
function picklistOf(root, files, fieldXml) {
  const f = parseXml(fieldXml).CustomField || {};
  const vs = f.valueSet || {};
  const result = { restricted: bool(vs.restricted), controllingField: vs.controllingField || null, global: vs.valueSetName || null, values: [], valueSettings: [], file: null };
  if (vs.valueSetName) {
    const g = (files.globalValueSet || []).find((x) => baseName(x, 'globalValueSet') === vs.valueSetName);
    if (g) {
      const gv = parseXml(read(g)).GlobalValueSet || {};
      result.values = arr(gv.customValue).map((v) => ({ name: String(v.fullName), label: v.label ? String(v.label) : String(v.fullName), active: v.isActive === undefined ? true : bool(v.isActive) }));
      result.file = rel(root, g);
    }
  } else {
    result.values = arr(vs.valueSetDefinition?.value).map((v) => ({ name: String(v.fullName), label: v.label ? String(v.label) : String(v.fullName), active: v.isActive === undefined ? true : bool(v.isActive) }));
  }
  result.valueSettings = arr(vs.valueSettings).map((s) => ({ value: String(s.valueName), controlling: arr(s.controllingFieldValue).map(String) }));
  return result;
}

/** Edit distance, for "did you mean" suggestions. */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Values that look like the one asked for (typo, singular/plural, another spelling). */
function closeValues(values, wanted) {
  const w = fold(wanted);
  return values.filter((v) => {
    const n = fold(v.name);
    const l = fold(v.label);
    return n.startsWith(w.slice(0, 5)) && w.length >= 5 || distance(n, w) <= Math.max(2, Math.floor(w.length / 5)) || distance(l, w) <= 2 || n.includes(w) || w.includes(n) && n.length >= 4;
  }).map((v) => v.name).slice(0, 3);
}

/** Finds the value by API name or label, without minding case or accents. */
function findValue(values, wanted) {
  const w = fold(wanted);
  return values.find((v) => fold(v.name) === w) || values.find((v) => fold(v.label) === w) || null;
}

/** Field permission of one profile/permission set for Object.Field: 'edit', 'read', 'none' or null (not listed). */
function fieldAccess(xml, ref) {
  for (const b of blocks(xml, 'fieldPermissions')) {
    if (tagOf(b, 'field') !== ref) continue;
    if (tagOf(b, 'editable') === 'true') return 'edit';
    if (tagOf(b, 'readable') === 'true') return 'read';
    return 'none';
  }
  return null;
}

/** Investigates a field and, optionally, one of its picklist values. */
function fieldReport(root, files, ref, { value, recordTypes: onlyRts, permissions: onlyPerms } = {}) {
  const [object, field] = ref.split('.');
  const gaps = [];
  const ok = [];
  const fieldFile = (files.field || []).find((f) => f.split(path.sep).join('/').endsWith(`/objects/${object}/fields/${field}.field-meta.xml`));
  if (!fieldFile) {
    return { target: ref, kind: 'field', exists: false, gaps: [{ area: 'campo', where: ref, what: `O campo ${ref} não está no projeto: ele precisa ser criado (ou o retrieve não trouxe).` }], ok, details: {} };
  }
  const fieldXml = read(fieldFile);
  const def = parseXml(fieldXml).CustomField || {};
  const required = bool(def.required);
  const details = { file: rel(root, fieldFile), type: def.type || null, label: def.label || null, required };
  const pick = /picklist/i.test(def.type || '') ? picklistOf(root, files, fieldXml) : null;
  let target = null;
  if (pick) {
    details.picklist = { values: pick.values.map((v) => v.name), global: pick.global, restricted: pick.restricted, controllingField: pick.controllingField };
    if (value) {
      target = findValue(pick.values, value);
      const close = target ? [] : closeValues(pick.values, value);
      if (!target) gaps.push({ area: 'valor', where: pick.global ? `Global value set ${pick.global}` : ref, what: `O valor "${value}" não existe em ${pick.global ? `${pick.global} (global value set)` : ref}${close.length ? `. Parecidos que já existem: ${close.map((c) => `"${c}"`).join(', ')} (confira se é um deles)` : ': precisa ser criado'}.`, file: pick.file || details.file });
      else if (!target.active) gaps.push({ area: 'valor', where: pick.global || ref, what: `O valor "${target.name}" existe, mas está inativo.`, file: pick.file || details.file });
      else ok.push(`O valor "${target.name}" já existe e está ativo${pick.global ? ` (global value set ${pick.global})` : ''}.`);
      if (target && pick.controllingField) {
        const s = pick.valueSettings.find((x) => fold(x.value) === fold(target.name));
        if (!s || !s.controlling.length) gaps.push({ area: 'dependência', where: ref, what: `${ref} depende de ${pick.controllingField}, e "${target.name}" não está liberado para nenhum valor dele (valueSettings).`, file: details.file });
        else ok.push(`Depende de ${pick.controllingField}: liberado quando ele é ${s.controlling.join(', ')}.`);
      }
    }
  }

  // Record types (and business processes, for StageName-like fields)
  const rtFiles = (files.recordType || []).filter((f) => f.split(path.sep).join('/').includes(`/objects/${object}/recordTypes/`));
  const rts = [];
  for (const f of rtFiles) {
    const name = baseName(f, 'recordType');
    if (onlyRts && onlyRts.length && !onlyRts.some((r) => fold(r) === fold(name))) continue;
    const xml = read(f);
    const active = tagOf(xml, 'active') !== 'false';
    const rt = { name, active, file: rel(root, f) };
    if (pick) {
      const block = blocks(xml, 'picklistValues').find((b) => tagOf(b, 'picklist') === field);
      rt.listed = Boolean(block);
      if (block) rt.values = blocks(block, 'values').map((v) => decode(tagOf(v, 'fullName') || ''));
      if (value && target && active) {
        if (!block) gaps.push({ area: 'record type', where: `${object}.${name}`, what: `O record type ${name} não lista ${field}: no Salesforce, os valores novos não entram nele sozinhos. Confira e inclua "${target.name}".`, file: rt.file });
        else if (!rt.values.some((v) => fold(v) === fold(target.name))) gaps.push({ area: 'record type', where: `${object}.${name}`, what: `"${target.name}" não está liberado no record type ${name}.`, file: rt.file });
        else ok.push(`Liberado no record type ${name}.`);
      }
      if (value && !target && active && block) gaps.push({ area: 'record type', where: `${object}.${name}`, what: `Depois de criar "${value}", libere no record type ${name} (ele lista os valores de ${field} um a um).`, file: rt.file });
    }
    const bp = tagOf(xml, 'businessProcess');
    if (bp) rt.businessProcess = bp;
    rts.push(rt);
  }
  details.recordTypes = rts.map(({ name, active, businessProcess }) => ({ name, active, businessProcess: businessProcess || null }));
  if (value && target && field === 'StageName') {
    for (const f of (files.businessProcess || []).filter((x) => x.split(path.sep).join('/').includes(`/objects/${object}/`))) {
      const name = baseName(f, 'businessProcess');
      const values = blocks(read(f), 'values').map((v) => decode(tagOf(v, 'fullName') || ''));
      if (!values.some((v) => fold(v) === fold(target.name))) gaps.push({ area: 'business process', where: name, what: `"${target.name}" não está no business process ${name}.`, file: rel(root, f) });
    }
  }

  // Field permissions (a required field is always visible: no FLS)
  if (!required && !/formula|summary|autonumber/i.test(`${def.type} ${def.formula ? 'formula' : ''}`)) {
    const perms = permissionFiles(root, files).filter((p) => !onlyPerms || !onlyPerms.length || onlyPerms.some((n) => fold(n) === fold(p.name)));
    const by = { edit: [], read: [], none: [] };
    for (const p of perms) by[fieldAccess(p.xml, ref) || 'none'].push(`${p.name}${p.kind === 'Profile' ? ' (profile)' : ''}`);
    details.access = by;
    details.permissionFiles = perms.length;
    if (onlyPerms && onlyPerms.length) for (const n of by.none) gaps.push({ area: 'acesso ao campo', where: n.replace(/ \(profile\)$/, ''), what: `${n} não dá acesso a ${ref}.` });
    else if (perms.length && !by.edit.length && !by.read.length) gaps.push({ area: 'acesso ao campo', where: ref, what: `Nenhum profile ou permission set do projeto dá acesso a ${ref} (FLS).` });

    if (by.edit.length || by.read.length) ok.push(`Acesso ao campo: edição em ${by.edit.length}, só leitura em ${by.read.length}, sem acesso em ${by.none.length} profile(s)/permission set(s).`);
  } else details.access = null;

  // Layouts: which have the field, and the layout each record type uses (per profile)
  const layouts = (files.layout || []).filter((f) => path.basename(f).startsWith(`${object}-`));
  const withField = new Set();
  for (const f of layouts) if (new RegExp(`<field>${field}</field>`).test(read(f))) withField.add(baseName(f, 'layout'));
  details.layouts = { total: layouts.length, withField: [...withField], without: layouts.map((f) => baseName(f, 'layout')).filter((n) => !withField.has(n)) };
  const assignments = new Map();
  for (const p of permissionFiles(root, files).filter((x) => x.kind === 'Profile')) {
    for (const b of blocks(p.xml, 'layoutAssignments')) {
      const layout = tagOf(b, 'layout');
      if (!layout || !layout.startsWith(`${object}-`)) continue;
      const rt = tagOf(b, 'recordType');
      const key = `${rt ? rt.split('.').pop() : '(sem record type)'}→${layout}`;
      (assignments.get(key) || assignments.set(key, []).get(key)).push(p.name);
    }
  }
  details.layoutAssignments = [...assignments].map(([k, profiles]) => ({ recordType: k.split('→')[0], layout: k.split('→')[1], profiles }));
  for (const a of details.layoutAssignments) {
    if (onlyRts && onlyRts.length && !onlyRts.some((r) => fold(r) === fold(a.recordType))) continue;
    if (layouts.length && !withField.has(a.layout)) gaps.push({ area: 'layout', where: a.layout, what: `O layout ${a.layout} (record type ${a.recordType}, ${a.profiles.length} profile(s)) não tem ${field}.`, file: rel(root, layouts.find((f) => baseName(f, 'layout') === a.layout) || '') || null });
  }
  if (!details.layoutAssignments.length && layouts.length && !withField.size) gaps.push({ area: 'layout', where: object, what: `Nenhum layout de ${object} tem ${field}.` });

  // Record pages (Dynamic Forms / field sections)
  details.flexipages = (files.flexipage || []).filter((f) => new RegExp(`Record\\.${field}\\b|>${field}<`).test(read(f))).map((f) => baseName(f, 'flexipage'));

  if (pick && target) {
    // Path
    for (const f of files.pathAssistant || []) {
      const xml = read(f);
      if (tagOf(xml, 'fieldName') !== field || !new RegExp(`<sobjectType>${object}</sobjectType>`).test(xml)) continue;
      const steps = blocks(xml, 'pathAssistantSteps').map((s) => tagOf(s, 'picklistValueName'));
      if (!steps.some((s) => fold(s) === fold(target.name))) gaps.push({ area: 'path', where: baseName(f, 'pathAssistant'), what: `O path ${baseName(f, 'pathAssistant')} não tem uma etapa para "${target.name}" (os outros valores têm).`, file: rel(root, f) });
    }
    // Translations
    for (const f of (files.fieldTranslation || []).filter((x) => path.basename(x) === `${field}.fieldTranslation-meta.xml` && x.split(path.sep).join('/').includes(`/${object}-`))) {
      const xml = read(f);
      const lang = path.basename(path.dirname(f)).replace(`${object}-`, '');
      const masters = blocks(xml, 'picklistValues').map((b) => tagOf(b, 'masterLabel'));
      if (masters.length && !masters.some((m) => fold(m) === fold(target.label) || fold(m) === fold(target.name))) gaps.push({ area: 'tradução', where: `${object} (${lang})`, what: `Falta a tradução de "${target.name}" em ${lang} (os outros valores estão traduzidos).`, file: rel(root, f) });
    }
    gaps.push(...siblingReferences(root, files, { object, field, target, values: pick.values }));
  }
  return { target: ref, kind: 'field', value: value || null, valueFound: target ? target.name : null, exists: true, gaps, ok, details };
}

/**
 * Rules and code that name two or more of the other values of the field but not this one: a validation rule with
 * ISPICKVAL for each stage, a flow decision, an Apex switch, a screen config. They may need the new value too.
 */
function siblingReferences(root, files, { object, field, target, values }) {
  const others = values.filter((v) => v.name !== target.name && v.name.length > 1);
  if (others.length < 2) return [];
  const out = [];
  const quoted = (text, v) => new RegExp(`['"]${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]|>${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`).test(text);
  const scan = (list, area, mentionsField) => {
    for (const f of list || []) {
      const text = read(f);
      if (!mentionsField(text)) continue;
      const named = others.filter((v) => quoted(text, v.name));
      if (named.length >= 2 && !quoted(text, target.name)) {
        out.push({ area, where: rel(root, f), what: `Cita ${named.length} valores de ${field} (${named.slice(0, 3).map((v) => v.name).join(', ')}...) mas não "${target.name}": confira se precisa incluir.`, file: rel(root, f) });
      }
    }
  };
  const fieldRe = new RegExp(`\\b${field}\\b`);
  scan((files.validationRule || []).filter((f) => f.split(path.sep).join('/').includes(`/objects/${object}/`)), 'validation rule', (t) => fieldRe.test(t));
  scan(files.flow, 'flow', (t) => fieldRe.test(t));
  scan((files.field || []).filter((f) => f.split(path.sep).join('/').includes(`/objects/${object}/`) && !f.endsWith(`/${field}.field-meta.xml`)), 'fórmula', (t) => fieldRe.test(t) && /<formula>/.test(t));
  scan([...(files.cls || []), ...(files.trigger || [])], 'Apex', (t) => fieldRe.test(t));
  const smallResources = (files.resource || []).filter((f) => { try { return fs.statSync(f).size < 2e6; } catch { return false; } });
  scan([...(files.js || []), ...(files.json || []), ...smallResources], 'tela ou configuração', (t) => fieldRe.test(t));
  return out.slice(0, 20);
}

/** Object access: object permissions, tab and record type visibility in profiles and permission sets. */
function objectReport(root, files, object, { recordTypes: onlyRts } = {}) {
  const perms = permissionFiles(root, files);
  const by = { edit: [], read: [], none: [] };
  for (const p of perms) {
    const b = blocks(p.xml, 'objectPermissions').find((x) => tagOf(x, 'object') === object);
    const level = !b ? 'none' : tagOf(b, 'allowEdit') === 'true' || tagOf(b, 'allowCreate') === 'true' ? 'edit' : tagOf(b, 'allowRead') === 'true' ? 'read' : 'none';
    by[level].push(`${p.name}${p.kind === 'Profile' ? ' (profile)' : ''}`);
  }
  const gaps = [];
  if (perms.length && !by.edit.length && !by.read.length) gaps.push({ area: 'acesso ao objeto', where: object, what: `Nenhum profile ou permission set do projeto dá acesso a ${object}.` });
  const rtVisibility = [];
  const rtNames = (files.recordType || []).filter((f) => f.split(path.sep).join('/').includes(`/objects/${object}/recordTypes/`)).map((f) => baseName(f, 'recordType'))
    .filter((n) => !onlyRts || !onlyRts.length || onlyRts.some((r) => fold(r) === fold(n)));
  for (const rt of rtNames) {
    const visible = perms.filter((p) => blocks(p.xml, 'recordTypeVisibilities').some((b) => tagOf(b, 'recordType') === `${object}.${rt}` && tagOf(b, 'visible') === 'true')).map((p) => p.name);
    rtVisibility.push({ recordType: rt, visibleIn: visible });
    if (perms.length && !visible.length) gaps.push({ area: 'record type', where: `${object}.${rt}`, what: `Nenhum profile ou permission set do projeto deixa o record type ${rt} visível.` });
  }
  return { target: object, kind: 'object', exists: true, gaps, ok: by.edit.length || by.read.length ? [`Acesso ao objeto: edição em ${by.edit.length}, só leitura em ${by.read.length}, sem acesso em ${by.none.length}.`] : [], details: { access: by, recordTypes: rtVisibility } };
}

/** Apex class access (classAccesses). */
function classReport(root, files, name) {
  const perms = permissionFiles(root, files);
  const withAccess = perms.filter((p) => blocks(p.xml, 'classAccesses').some((b) => tagOf(b, 'apexClass') === name && tagOf(b, 'enabled') === 'true')).map((p) => p.name);
  const gaps = perms.length && !withAccess.length ? [{ area: 'acesso à classe', where: name, what: `Nenhum profile ou permission set do projeto libera a classe ${name} (necessário para @AuraEnabled, REST e Visualforce).` }] : [];
  return { target: name, kind: 'class', exists: true, gaps, ok: withAccess.length ? [`Liberada em ${withAccess.length}: ${withAccess.slice(0, 8).join(', ')}`] : [], details: { withAccess } };
}

/** Entry point: decides what the target is and investigates it. */
function accessReport(root, target, options = {}) {
  const files = projectFiles(root);
  if (target.includes('.')) return fieldReport(root, files, target, options);
  if ((files.cls || []).some((f) => path.basename(f) === `${target}.cls`)) return classReport(root, files, target);
  return objectReport(root, files, target, options);
}

module.exports = { accessReport, fieldReport, objectReport, classReport, findValue, fieldAccess, projectFiles };
