'use strict';

/**
 * Dynamic fields: the developer's second look before removing or renaming a field.
 *
 * Some code does not name the field: it reads the name from data (custom metadata, a custom setting, a config
 * object) or receives it in a JSON built by a screen, and then reaches the field with record.get(name), a describe
 * map or a query built as text. The index cannot tie those uses to an object, but it can say:
 *  - which objects keep field names (the "stores") and which classes read them and reach fields by name;
 *  - for custom metadata, whose records live in the project: which records mention the field (checked);
 *  - for custom settings and objects, whose records live only in the org: a query to check there;
 *  - which texts in code name the field (a JSON in an LWC, a field list in Apex), to change by hand.
 * Reldor reads metadata only, never records.
 */

const FIELD_NAME_RE = /(^|_)(fields?|columns?|campos?|colunas?)(_?api)?(_?names?|_?nomes?)?(_?ids?)?__c$|field_?api_?name|field_?name|nome_?(do_?)?campo/i;
const OBJECT_NAME_RE = /(^|_)(object|objeto|sobject|entity|table)(_?api)?(_?names?)?__c$/i;
const TEXT_TYPES = /^(Text|TextArea|LongTextArea|Html|Picklist|MultiselectPicklist)$/i;

/** Fields of an object that hold field names (and the ones that hold object names). */
function storeFields(o) {
  const fields = [];
  const objectFields = [];
  for (const f of Object.values(o.fields || {})) {
    const ref = String(f.referenceTo || '');
    if (f.type === 'MetadataRelationship' && /^(FieldDefinition|EntityParticle)$/i.test(ref)) fields.push({ name: f.name, type: f.type, definition: true });
    else if (f.type === 'MetadataRelationship' && /^EntityDefinition$/i.test(ref)) objectFields.push(f.name);
    else if (FIELD_NAME_RE.test(f.name) && (!f.type || TEXT_TYPES.test(f.type))) fields.push({ name: f.name, type: f.type || 'Text' });
    else if (OBJECT_NAME_RE.test(f.name) && (!f.type || TEXT_TYPES.test(f.type))) objectFields.push(f.name);
  }
  return { fields, objectFields };
}

/** Objects whose records keep field names. */
function fieldStores(model) {
  const out = [];
  for (const o of Object.values(model.objects)) {
    const { fields, objectFields } = storeFields(o);
    if (!fields.length) continue;
    const kind = o.customMetadata || /__mdt$/i.test(o.name) ? 'custom metadata' : o.customSetting ? 'custom setting' : 'objeto';
    out.push({ object: o.name, kind, fields, objectFields });
  }
  return out;
}

/** Classes and flows that read a store, and whether they reach fields by name (dynamic access). */
function readersOf(model, store) {
  const readers = [];
  const lower = store.toLowerCase();
  for (const c of Object.values(model.classes)) {
    if (c.isTest) continue;
    const queries = (c.soql || []).some((q) => String(q.object).toLowerCase() === lower);
    const names = (c.identifiers || []).some((id) => id.toLowerCase() === lower);
    if (!queries && !names) continue;
    readers.push({ where: 'Apex', name: c.name, dynamic: (c.dynamicAccess || []).filter((d) => d.kind !== 'JSON').slice(0, 3) });
  }
  for (const f of Object.values(model.flows)) if ((f.reads || []).some((r) => String(r).toLowerCase() === lower)) readers.push({ where: 'Flow', name: f.name, dynamic: [] });
  return readers;
}

/** Same name, allowing the project's own namespace prefix (npsp__Amount__c is Amount__c in an npsp project). */
function sameField(model, a, b) {
  const x = String(a || '').toLowerCase();
  const y = String(b || '').toLowerCase();
  if (x === y) return true;
  const ns = model.namespace ? `${String(model.namespace).toLowerCase()}__` : null;
  return Boolean(ns) && (x === ns + y || y === ns + x);
}

/** Does a stored value name this field (Amount__c, npsp__Amount__c, Opportunity.Amount__c, "Amount__c,Stage__c")? */
function valueNames(model, value, object, field) {
  const parts = String(value || '').split(/[\s,;|]+/).filter(Boolean);
  return parts.some((p) => {
    const segs = p.split('.');
    const last = segs[segs.length - 1];
    if (!sameField(model, last, field)) return false;
    if (segs.length === 1 || !object) return true;
    return sameField(model, segs[segs.length - 2], object);
  });
}

/**
 * The dynamic-field analysis for one field. `possibleHits` are the usages that could not be tied to an object
 * (texts in code). Returns { stores: [...], texts: [...] }.
 */
function analyzeDynamicField(model, object, field, possibleHits = []) {
  const stores = [];
  for (const s of fieldStores(model)) {
    const readers = readersOf(model, s.object);
    const engines = readers.filter((r) => r.dynamic.length);
    const entry = { object: s.object, kind: s.kind, fields: s.fields.map((f) => f.name), readers: readers.map((r) => `${r.where} ${r.name}`), engines: engines.map((e) => ({ name: e.name, how: e.dynamic.map((d) => `${d.what} (linha ${d.line})`) })) };
    if (s.kind === 'custom metadata') {
      // Records are metadata: they are in the project, so the check is done here.
      const records = (model.customMetadata[s.object] || []).filter((r) => {
        const names = s.fields.some((f) => valueNames(model, r.values[f.name], object, field));
        if (!names) return false;
        if (!object || !s.objectFields.length) return true;
        const objs = s.objectFields.map((f) => r.values[f]).filter(Boolean);
        return !objs.length || objs.some((v) => sameField(model, v, object) || String(v).toLowerCase() === String(object).toLowerCase());
      });
      entry.checked = true;
      entry.recordCount = (model.customMetadata[s.object] || []).length;
      entry.records = records.map((r) => r.name);
    } else {
      // Records are data in the org: Reldor does not read them; it hands over the query to run.
      const text = s.fields.filter((f) => !/^LongTextArea|Html$/i.test(f.type));
      const long = s.fields.filter((f) => /^LongTextArea|Html$/i.test(f.type));
      const fieldName = model.namespace ? `${model.namespace}__${field}` : field;
      const like = text.map((f) => `${f.name} LIKE '%${field}%'`);
      entry.checked = false;
      entry.query = text.length ? `SELECT Id, ${[...new Set([...text.map((f) => f.name), ...s.objectFields])].join(', ')} FROM ${s.object} WHERE ${like.join(' OR ')}` : null;
      entry.longFields = long.map((f) => f.name);
      if (model.namespace && fieldName !== field) entry.namespaceNote = `procure também por ${fieldName}`;
    }
    stores.push(entry);
  }
  // Order: what can matter first (records found, then engines that read by name, then the rest).
  const score = (e) => (e.records && e.records.length ? 0 : e.engines.length ? 1 : e.readers.length ? 2 : 3);
  stores.sort((a, b) => score(a) - score(b) || a.object.localeCompare(b.object));
  const texts = possibleHits.map((h) => ({ where: h.where, name: h.name, how: h.how }));
  return { stores, texts };
}

/** Lines for the terminal. */
function renderDynamicField(object, field, analysis, { max = 6 } = {}) {
  const { stores, texts } = analysis;
  // Records found here, or data in the org read by code that reaches fields by name.
  const relevant = stores.filter((s) => (s.checked && s.records.length) || (!s.checked && s.engines.length));
  const quiet = stores.filter((s) => s.checked && !s.records.length);
  if (!relevant.length && !texts.length && !quiet.length) return [];
  const out = ['', `🔎 Campos dinâmicos: o que o código não diz, a análise de um desenvolvedor confere`];
  for (const s of relevant.slice(0, max)) {
    const engines = s.engines.length ? ` · usado por nome em ${s.engines.slice(0, 3).map((e) => `${e.name} (${e.how[0]})`).join(', ')}${s.engines.length > 3 ? ` e mais ${s.engines.length - 3}` : ''}` : s.readers.length ? ` · lido por ${s.readers.slice(0, 3).join(', ')}` : '';
    if (s.checked) {
      out.push(`• ${s.object} (${s.kind}) guarda nomes de campo em ${s.fields.join(', ')}${engines}.`);
      out.push(`  ✅ Conferido no projeto: ${s.records.length} registro(s) citam ${field}: ${s.records.slice(0, 6).join(', ')}${s.records.length > 6 ? ', ...' : ''}. Ajuste ou apague esses registros junto.`);
    } else {
      out.push(`• ${s.object} (${s.kind}) guarda nomes de campo em ${s.fields.join(', ')}${engines}.`);
      out.push(`  👉 Os registros ficam na org (o Reldor não lê dados). Confira se algum cita ${field}:`);
      if (s.query) out.push(`     ${s.query}`);
      if (s.longFields.length) out.push(`     ${s.longFields.join(', ')} é texto longo (não filtra na SOQL): exporte e procure.`);
      if (s.namespaceNote) out.push(`     (${s.namespaceNote})`);
    }
  }
  if (relevant.length > max) out.push(`• e mais ${relevant.length - max} objeto(s) que guardam nomes de campo (veja com --json).`);
  if (quiet.length) out.push(`• Conferido sem achar ${field}: ${quiet.slice(0, 6).map((s) => `${s.object} (${s.recordCount} registros)`).join(', ')}${quiet.length > 6 ? ', ...' : ''}.`);
  if (texts.length) {
    out.push(`• Texto fixo no código que cita ${field} sem dizer o objeto (lista de campos, JSON de uma tela, SOQL em texto):`);
    for (const t of texts.slice(0, 8)) out.push(`    ${t.where} ${t.name} — ${t.how.replace(/^não dá para saber o objeto: /, '')}`);
    if (texts.length > 8) out.push(`    e mais ${texts.length - 8}.`);
    out.push('  Se o campo for removido ou renomeado, esses textos quebram em tempo de execução, não na compilação.');
  }
  return out;
}

module.exports = { analyzeDynamicField, renderDynamicField, fieldStores, readersOf, sameField };
