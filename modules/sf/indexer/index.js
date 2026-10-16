'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { paths } = require('../../../core/config');
const { readProject } = require('..');
const { classify, parseFile } = require('./parsers');

const INDEX_VERSION = 8;
const SKIP_DIRS = new Set(['node_modules', '.git', '.sfdx', '.sf', '.reldor', '__tests__', 'jsconfig.json']);

function walk(dir, files = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (classify(full)) files.push(full);
  }
  return files;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function cacheFiles(root) {
  const dir = paths(root).cache;
  return { dir, files: path.join(dir, 'files.json'), index: path.join(dir, 'index.json') };
}

function emptyObject(name) {
  return {
    name,
    label: name,
    customSetting: false,
    customMetadata: name.endsWith('__mdt'),
    fields: {},
    validationRules: [],
    recordTypes: [],
    duplicateRules: [],
    workflow: null,
    triggers: [],
    flows: { before: [], after: [], process: [] },
    selectors: [],
    domain: null,
    parents: [],
    rollupsTo: [],
    queriedBy: [],
    writtenBy: [],
    lwcs: [],
  };
}

/** Turns per-file results into a model organized by object. */
function aggregate(fileResults) {
  const model = { objects: {}, classes: {}, triggers: {}, flows: {}, lwc: {}, customMetadata: {}, ui: [], permissions: [], application: { services: {}, selectors: {}, domains: {} }, errors: [] };
  const obj = (name) => {
    if (!name) return null;
    if (!model.objects[name]) model.objects[name] = emptyObject(name);
    return model.objects[name];
  };

  for (const [file, r] of Object.entries(fileResults)) {
    if (r.error) {
      model.errors.push(r.error);
      continue;
    }
    const d = r.data;
    switch (r.type) {
      case 'object':
        Object.assign(obj(d.object), { label: d.label, customSetting: d.customSetting, customMetadata: d.customMetadata });
        break;
      case 'field':
        obj(d.object).fields[d.name] = d;
        break;
      case 'validationRule':
        obj(d.object).validationRules.push(d);
        break;
      case 'recordType':
        obj(d.object).recordTypes.push(d);
        break;
      case 'duplicateRule':
        obj(d.object).duplicateRules.push(d);
        break;
      case 'workflow':
        obj(d.object).workflow = d;
        break;
      case 'class':
        model.classes[d.name] = { ...d, file };
        if (d.application) {
          for (const kind of ['services', 'selectors', 'domains']) Object.assign(model.application[kind], d.application[kind]);
        }
        break;
      case 'trigger':
        model.triggers[d.name] = { ...d, file };
        break;
      case 'flow':
        model.flows[d.name] = { ...d, file };
        break;
      case 'layout':
      case 'listView':
      case 'compactLayout':
        model.ui.push({ kind: r.type, ...d });
        break;
      case 'permission':
        model.permissions.push(d);
        break;
      case 'customMetadataRecord':
        (model.customMetadata[d.object] = model.customMetadata[d.object] || []).push(d);
        break;
      case 'lwcJs':
        model.lwc[d.name] = { ...(model.lwc[d.name] || {}), apex: d.apex, schema: d.schema };
        break;
      case 'lwcHtml':
        model.lwc[d.name] = { ...(model.lwc[d.name] || {}), children: d.children };
        break;
      default:
        break;
    }
  }

  for (const t of Object.values(model.triggers)) if (t.object) obj(t.object).triggers.push(t.name);

  for (const f of Object.values(model.flows)) {
    if (!f.object || !f.timing) continue;
    obj(f.object).flows[f.timing].push(f.name);
  }

  for (const o of Object.values(model.objects)) {
    for (const field of Object.values(o.fields)) {
      if (field.type === 'MasterDetail' && field.referenceTo) o.parents.push({ parent: field.referenceTo, field: field.name, masterDetail: true });
      else if (field.type === 'Lookup' && field.referenceTo) o.parents.push({ parent: field.referenceTo, field: field.name, masterDetail: false });
      if (field.summary && field.summary.foreignKey) {
        const [child] = field.summary.foreignKey.split('.');
        obj(child).rollupsTo.push({ parent: o.name, field: field.name, operation: field.summary.operation });
      }
    }
  }

  for (const [object, selector] of Object.entries(model.application.selectors)) obj(object).selectors.push(selector);
  for (const [object, domain] of Object.entries(model.application.domains)) obj(object).domain = domain;

  const isObjectName = (name) => Boolean(model.objects[name]) || /__(c|e|mdt)$/.test(name);
  for (const c of Object.values(model.classes)) {
    if (c.selectorObject && !obj(c.selectorObject).selectors.includes(c.name)) obj(c.selectorObject).selectors.push(c.name);
    if (c.isTest) continue;
    for (const q of c.soql) if (isObjectName(q.object) && !obj(q.object).queriedBy.includes(c.name)) obj(q.object).queriedBy.push(c.name);
    for (const d of c.dml) if (d.type && isObjectName(d.type) && !obj(d.type).writtenBy.includes(c.name)) obj(d.type).writtenBy.push(c.name);
  }

  for (const [name, l] of Object.entries(model.lwc)) {
    for (const s of l.schema || []) {
      const [object] = s.split('.');
      if (object && !obj(object).lwcs.includes(name)) obj(object).lwcs.push(name);
    }
  }
  return model;
}

/**
 * Builds or updates the index. Only files whose size or modification time changed are parsed again.
 * Returns { model, stats }.
 */
function buildIndex(root, options = {}) {
  const started = Date.now();
  const project = readProject(root) || { packageDirectories: ['force-app'] };
  const cache = cacheFiles(root);
  const previous = options.full ? null : readJson(cache.files);
  const prevFiles = previous && previous.version === INDEX_VERSION ? previous.files : {};

  const files = project.packageDirectories.flatMap((dir) => walk(path.join(root, dir)));
  const results = {};
  let parsed = 0;
  let reused = 0;
  for (const full of files) {
    const rel = path.relative(root, full).split(path.sep).join('/');
    const stat = fs.statSync(full);
    const prev = prevFiles[rel];
    if (prev && prev.mtime === stat.mtimeMs && prev.size === stat.size) {
      results[rel] = prev;
      reused += 1;
      continue;
    }
    const r = parseFile(full, fs.readFileSync(full, 'utf8'));
    if (r) results[rel] = { ...r, mtime: stat.mtimeMs, size: stat.size };
    parsed += 1;
  }
  const removed = Object.keys(prevFiles).filter((rel) => !results[rel]).length;

  const model = aggregate(results);
  const stats = {
    files: Object.keys(results).length,
    parsed,
    reused,
    removed,
    objects: Object.keys(model.objects).length,
    classes: Object.keys(model.classes).length,
    triggers: Object.keys(model.triggers).length,
    flows: Object.keys(model.flows).length,
    lwc: Object.keys(model.lwc).length,
    errors: model.errors.length,
    ms: Date.now() - started,
  };

  fs.mkdirSync(cache.dir, { recursive: true });
  fs.writeFileSync(cache.files, JSON.stringify({ version: INDEX_VERSION, files: results }));
  fs.writeFileSync(cache.index, JSON.stringify({ version: INDEX_VERSION, generatedAt: new Date().toISOString(), stats, model }));
  return { model, stats };
}

/** Loads the saved index, or null. */
function loadIndex(root) {
  const data = readJson(cacheFiles(root).index);
  return data && data.version === INDEX_VERSION ? data : null;
}

/** Age of the saved index in hours, or Infinity. */
function indexAgeHours(root) {
  const data = loadIndex(root);
  if (!data) return Infinity;
  return (Date.now() - Date.parse(data.generatedAt)) / 36e5;
}

/** Returns a fresh-enough index, rebuilding incrementally when it is old or missing. */
function ensureIndex(root, config, options = {}) {
  const maxAge = config?.index?.refresh_hours ?? 24;
  if (!options.refresh && indexAgeHours(root) < maxAge) return loadIndex(root);
  buildIndex(root, options);
  return loadIndex(root);
}

module.exports = { buildIndex, loadIndex, ensureIndex, indexAgeHours, aggregate, INDEX_VERSION };
