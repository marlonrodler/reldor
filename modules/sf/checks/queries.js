'use strict';

/**
 * Query check: a custom field read from a record that the class queried, but that is not in the query.
 * Runtime error it prevents: "SObject row was retrieved via SOQL without querying the requested field".
 *
 * Only classes that query the object themselves (SOQL or a selector) are checked; records that arrive as
 * parameters or from Trigger.new cannot be judged, so they are skipped.
 */
function selectorsUsedBy(model, cls, object) {
  const fromIndex = model.objects[object]?.selectors || [];
  const viaApplication = cls.identifiers.includes('Application') && cls.identifiers.includes(object);
  return fromIndex.filter((s) => cls.identifiers.includes(s) || viaApplication);
}

function queriedFields(model, cls, object) {
  const fields = new Set();
  let sources = 0;
  for (const q of cls.soql) {
    if (q.object !== object) continue;
    sources += 1;
    for (const f of q.fields) fields.add(f.split('.').pop().toLowerCase());
  }
  for (const s of selectorsUsedBy(model, cls, object)) {
    const sel = model.classes[s];
    if (!sel) continue;
    sources += 1;
    for (const f of sel.selectorFields || []) fields.add(f.split('.').pop().toLowerCase());
    for (const q of sel.soql) if (q.object === object) for (const f of q.fields) fields.add(f.split('.').pop().toLowerCase());
    for (const str of sel.strings || []) fields.add(str.toLowerCase());
  }
  return { fields, sources };
}

function checkClass(model, cls) {
  if (cls.isTest || cls.kinds.includes('domain') || cls.kinds.includes('trigger-handler') || cls.kinds.includes('selector')) return [];
  const issues = [];
  for (const read of cls.fieldReads || []) {
    const [variable, field] = read.split('.');
    const object = cls.varTypes?.[variable];
    if (!object || !model.objects[object]) continue;
    const { fields, sources } = queriedFields(model, cls, object);
    if (!sources) continue;
    if (fields.has(field.toLowerCase())) continue;
    issues.push({
      class: cls.name,
      object,
      field,
      variable,
      certainty: cls.dynamicSoql ? 'possível' : 'provável',
      hint: `${object}.${field} é lido em ${cls.name} (${variable}.${field}), mas não aparece na SOQL nem no Selector de ${object} que a classe usa.`,
    });
  }
  return issues;
}

/** Checks the given classes (or every class when `names` is empty). */
function checkQueries(model, names = []) {
  const list = names.length ? names.map((n) => model.classes[n]).filter(Boolean) : Object.values(model.classes);
  return list.flatMap((c) => checkClass(model, c));
}

module.exports = { checkQueries, checkClass, queriedFields };
