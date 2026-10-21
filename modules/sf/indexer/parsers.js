'use strict';

const path = require('node:path');
const { parseXml, bool, arr } = require('./xml');
const { parseApexClass, parseTrigger } = require('./apex');
const { flowFieldRefs, uiFieldRefs, metaFieldRefs } = require('./fieldrefs');

/** Field and object references inside a formula (validation rules, formula fields, flow formulas). */
function formulaRefs(text) {
  if (!text) return [];
  const tokens = String(text).match(/\$?[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*/g) || [];
  return [...new Set(tokens.filter((t) => !t.startsWith('$') && (/__(c|r)\b/.test(t) || t.includes('.'))))];
}

const META_LABEL = {
  report: 'Report', reportType: 'Report type', dashboard: 'Dashboard', fieldSet: 'Field set', quickAction: 'Quick action',
  flexipage: 'Página (FlexiPage)', layout: 'Layout', listView: 'List view', compactLayout: 'Compact layout', recordType: 'Record type',
  genAiPromptTemplate: 'Prompt template', genAiFunction: 'Ação de agente', pathAssistant: 'Path', app: 'App', sharingRules: 'Sharing rule',
  md: 'Custom metadata', webLink: 'Botão/link', email: 'E-mail template', matchingRule: 'Matching rule', matchingRules: 'Matching rule',
  duplicateRule: 'Duplicate rule', assignmentRules: 'Regra de atribuição', escalationRules: 'Regra de escalonamento', sharingSet: 'Sharing set',
  businessProcess: 'Business process', validationRule: 'Validation rule', approvalProcess: 'Processo de aprovação', navigationMenu: 'Menu',
};

/** Recognizes a metadata file by its path and returns { type, key } or null. */
function classify(file) {
  const parts = file.split(/[\\/]/);
  const base = parts[parts.length - 1];
  const parent = parts[parts.length - 2];
  const grand = parts[parts.length - 3];
  const great = parts[parts.length - 4];
  if (base.endsWith('.cls')) return { type: 'class', name: base.slice(0, -4) };
  if (base.endsWith('.trigger')) return { type: 'trigger', name: base.slice(0, -8) };
  if (base.endsWith('.flow-meta.xml')) return { type: 'flow', name: base.replace('.flow-meta.xml', '') };
  if (base.endsWith('.workflow-meta.xml')) return { type: 'workflow', object: base.replace('.workflow-meta.xml', '') };
  if (base.endsWith('.md-meta.xml') && parent === 'customMetadata') {
    const full = base.replace('.md-meta.xml', '');
    return { type: 'customMetadataRecord', object: `${full.split('.')[0]}__mdt`, name: full.split('.').slice(1).join('.') };
  }
  if (base.endsWith('.duplicateRule-meta.xml')) {
    const full = base.replace('.duplicateRule-meta.xml', '');
    return { type: 'duplicateRule', object: full.split('.')[0], name: full.split('.').slice(1).join('.') };
  }
  if (parent === 'fields' && base.endsWith('.field-meta.xml') && great === 'objects') return { type: 'field', object: grand, name: base.replace('.field-meta.xml', '') };
  if (parent === 'validationRules' && great === 'objects') return { type: 'validationRule', object: grand, name: base.replace('.validationRule-meta.xml', '') };
  if (parent === 'recordTypes' && great === 'objects') return { type: 'recordType', object: grand, name: base.replace('.recordType-meta.xml', '') };
  if (grand === 'objects' && base === `${parent}.object-meta.xml`) return { type: 'object', object: parent };
  if (base.endsWith('.layout-meta.xml')) return { type: 'layout', object: base.split('-')[0], name: base.replace('.layout-meta.xml', '') };
  if (parent === 'listViews' && great === 'objects') return { type: 'listView', object: grand, name: base.replace('.listView-meta.xml', '') };
  if (parent === 'compactLayouts' && great === 'objects') return { type: 'compactLayout', object: grand, name: base.replace('.compactLayout-meta.xml', '') };
  if (base.endsWith('.permissionset-meta.xml')) return { type: 'permission', kind: 'Permission set', name: base.replace('.permissionset-meta.xml', '') };
  if (base.endsWith('.profile-meta.xml')) return { type: 'permission', kind: 'Profile', name: base.replace('.profile-meta.xml', '') };
  if (grand === 'lwc' && (base === `${parent}.js` || base === `${parent}.html`)) return { type: base.endsWith('.js') ? 'lwcJs' : 'lwcHtml', name: parent };
  // Other screen code: LWC helper files, Aura bundles, Visualforce pages and components.
  const lwcAt = parts.lastIndexOf('lwc');
  if (lwcAt >= 0 && lwcAt < parts.length - 2 && /\.(js|html)$/.test(base) && !parts.includes('__tests__')) return { type: 'uiCode', kind: 'LWC', name: parts[lwcAt + 1] };
  const auraAt = parts.lastIndexOf('aura');
  if (auraAt >= 0 && auraAt < parts.length - 2 && /\.(cmp|app|js)$/.test(base)) return { type: 'uiCode', kind: 'Aura', name: parts[auraAt + 1] };
  if (base.endsWith('.page')) return { type: 'uiCode', kind: 'Visualforce', name: base.slice(0, -5) };
  if (base.endsWith('.component') && parent === 'components') return { type: 'uiCode', kind: 'Visualforce', name: base.slice(0, -10) };
  // Any other metadata: only its field references are read (reports, record pages, quick actions, field sets...).
  const meta = /^(.+)\.([A-Za-z]+)-meta\.xml$/.exec(base);
  if (meta && !/Translation$|^translation$|^(object|field|staticresource|document|contentasset|resource|cls|trigger|page|component|js|html|css|svg)$/i.test(meta[2]) && !(meta[2] === 'app' && parent !== 'applications') && !/\.(cls|trigger|page|component|resource)-meta\.xml$/.test(base)) {
    const objectAt = parts.lastIndexOf('objects');
    const inObject = objectAt >= 0 && objectAt === parts.length - 4 ? parts[objectAt + 1] : null;
    return { type: 'meta', where: META_LABEL[meta[2]] || meta[2], name: inObject ? `${inObject}.${meta[1]}` : meta[1] };
  }
  return null;
}

function parseField(meta, { object, name }) {
  const f = parseXml(meta).CustomField || {};
  const values = arr(f.valueSet?.valueSetDefinition?.value).map((v) => v.fullName).filter(Boolean);
  return {
    object,
    name: f.fullName || name,
    label: f.label || null,
    description: f.description ? String(f.description).slice(0, 300) : f.inlineHelpText ? String(f.inlineHelpText).slice(0, 300) : null,
    type: f.type || null,
    required: bool(f.required),
    unique: bool(f.unique),
    externalId: bool(f.externalId),
    referenceTo: arr(f.referenceTo)[0] || null,
    relationshipName: f.relationshipName || null,
    formula: f.formula ? String(f.formula) : null,
    formulaRefs: formulaRefs(f.formula),
    summary: f.summaryForeignKey
      ? { foreignKey: f.summaryForeignKey, field: f.summarizedField || null, operation: f.summaryOperation || null }
      : null,
    picklist: values.length ? values : null,
    globalValueSet: f.valueSet?.valueSetName || null,
  };
}

function parseValidationRule(meta, { object, name }) {
  const v = parseXml(meta).ValidationRule || {};
  return {
    object,
    name: v.fullName || name,
    active: bool(v.active),
    formula: v.errorConditionFormula ? String(v.errorConditionFormula) : '',
    refs: formulaRefs(v.errorConditionFormula),
    message: v.errorMessage || null,
  };
}

function parseRecordType(meta, { object, name }) {
  const r = parseXml(meta).RecordType || {};
  return { object, name: r.fullName || name, label: r.label || name, active: bool(r.active) };
}

function parseObject(meta, { object }) {
  const o = parseXml(meta).CustomObject || {};
  return {
    object,
    label: o.label || object,
    pluralLabel: o.pluralLabel || null,
    customSetting: Boolean(o.customSettingsType),
    customMetadata: object.endsWith('__mdt'),
  };
}

const EVENT_BY_TRIGGER_TYPE = { Create: ['insert'], Update: ['update'], CreateAndUpdate: ['insert', 'update'], Delete: ['delete'] };

function parseFlow(meta, { name }) {
  const f = parseXml(meta).Flow || {};
  const start = f.start || {};
  const processType = f.processType || null;
  let object = start.object || null;
  let timing = null;
  if (start.triggerType === 'RecordBeforeSave') timing = 'before';
  else if (start.triggerType === 'RecordAfterSave') timing = 'after';
  else if (start.triggerType === 'RecordBeforeDelete') timing = 'before';

  if (processType === 'Workflow') {
    const objectMeta = arr(f.processMetadataValues).find((p) => p.name === 'ObjectType');
    object = objectMeta?.value?.stringValue || object;
  }

  const fieldsWritten = new Set();
  for (const a of arr(f.assignments)) {
    for (const item of arr(a.assignmentItems)) {
      const ref = item.assignToReference || '';
      if (ref.startsWith('$Record.')) fieldsWritten.add(ref.slice('$Record.'.length));
    }
  }
  for (const u of arr(f.recordUpdates)) {
    if (u.inputReference === '$Record' || (!u.object && !u.inputReference)) {
      for (const ia of arr(u.inputAssignments)) if (ia.field) fieldsWritten.add(ia.field);
    }
  }

  const fieldsByObject = Object.create(null);
  for (const el of [...arr(f.recordCreates), ...arr(f.recordUpdates)]) {
    const target = el.object || (el.inputReference === '$Record' ? object : null);
    if (!target) continue;
    for (const ia of arr(el.inputAssignments)) if (ia.field) (fieldsByObject[target] = fieldsByObject[target] || new Set()).add(ia.field);
  }
  const filters = arr(start.filters).map((x) => ({ field: x.field, operator: x.operator }));
  return {
    name,
    label: f.label || name,
    processType,
    status: f.status || null,
    active: f.status === 'Active',
    object,
    timing: processType === 'Workflow' ? 'process' : timing,
    events: EVENT_BY_TRIGGER_TYPE[start.recordTriggerType] || (processType === 'Workflow' ? ['insert', 'update'] : []),
    conditional: Boolean(filters.length || start.filterFormula || start.filterLogic),
    filters,
    filterFormula: start.filterFormula ? String(start.filterFormula) : null,
    onlyWhenChanged: start.doesRequireRecordChangedToMeetCriteria === 'true',
    async: arr(start.scheduledPaths).length > 0,
    fieldsWritten: [...fieldsWritten],
    fieldsByObject: Object.fromEntries(Object.entries(fieldsByObject).map(([k, v]) => [k, [...v]])),
    creates: [...new Set(arr(f.recordCreates).map((c) => c.object).filter(Boolean))],
    updates: [...new Set(arr(f.recordUpdates).map((u) => u.object).filter(Boolean))],
    deletes: [...new Set(arr(f.recordDeletes).map((d) => d.object).filter(Boolean))],
    reads: [...new Set(arr(f.recordLookups).map((l) => l.object).filter(Boolean))],
    apexActions: [...new Set(arr(f.actionCalls).filter((a) => a.actionType === 'apex').map((a) => a.actionName))],
    subflows: [...new Set(arr(f.subflows).map((s) => s.flowName).filter(Boolean))],
    fieldUses: flowFieldRefs(f, object, meta),
  };
}

function parseWorkflow(meta, { object }) {
  const w = parseXml(meta).Workflow || {};
  return {
    object,
    rules: arr(w.rules).map((r) => ({ name: r.fullName, active: bool(r.active), triggerType: r.triggerType || null })),
    fieldUpdates: arr(w.fieldUpdates).map((u) => ({ name: u.fullName, field: u.field, reevaluate: bool(u.reevaluateOnChange) })),
  };
}

function parseDuplicateRule(meta, { object, name }) {
  const d = parseXml(meta).DuplicateRule || {};
  return { object, name, active: bool(d.isActive) };
}

function parseCustomMetadataRecord(meta, { object, name }) {
  const r = parseXml(meta).CustomMetadata || {};
  const values = Object.create(null);
  for (const v of arr(r.values)) {
    const value = arr(v.value)[0];
    values[v.field] = value && typeof value === 'object' ? value['#text'] ?? '' : value;
  }
  return { object, name, label: r.label || name, values };
}

/** Field names mentioned in layouts, list views and compact layouts (text scan, no full parse). */
function parseFieldMentions(meta, key) {
  const fields = [...meta.matchAll(/<(?:field|fields|columns)>([\w.]+)<\/(?:field|fields|columns)>/g)].map((m) => m[1]);
  return { object: key.object, name: key.name, fields: [...new Set(fields)] };
}

/** Field and Apex class access granted by a permission set or profile. */
function parsePermission(meta, key) {
  const fields = [...meta.matchAll(/<fieldPermissions>[\s\S]*?<field>([\w.]+)<\/field>[\s\S]*?<\/fieldPermissions>/g)].map((m) => m[1]);
  const classes = [...meta.matchAll(/<classAccesses>[\s\S]*?<apexClass>(\w+)<\/apexClass>[\s\S]*?<\/classAccesses>/g)].map((m) => m[1]);
  return { kind: key.kind, name: key.name, fields: [...new Set(fields)], classes: [...new Set(classes)] };
}

function parseLwcJs(source, { name }) {
  return {
    name,
    screen: uiFieldRefs('LWC', source),
    apex: [...new Set([...source.matchAll(/@salesforce\/apex\/([\w.]+)/g)].map((m) => m[1]))],
    schema: [...new Set([...source.matchAll(/@salesforce\/schema\/([\w.]+)/g)].map((m) => m[1]))],
  };
}

function parseLwcHtml(source, { name }) {
  return { name, children: [...new Set([...source.matchAll(/<c-([\w-]+)/g)].map((m) => m[1]))], screen: uiFieldRefs('LWC', source) };
}

const PARSERS = {
  class: (text, key) => parseApexClass(key.name, text),
  trigger: (text, key) => parseTrigger(key.name, text),
  field: parseField,
  validationRule: parseValidationRule,
  recordType: parseRecordType,
  object: parseObject,
  flow: parseFlow,
  workflow: parseWorkflow,
  duplicateRule: parseDuplicateRule,
  customMetadataRecord: parseCustomMetadataRecord,
  layout: parseFieldMentions,
  listView: parseFieldMentions,
  compactLayout: parseFieldMentions,
  permission: parsePermission,
  lwcJs: parseLwcJs,
  lwcHtml: parseLwcHtml,
  uiCode: (text, key) => ({ name: key.name, kind: key.kind, screen: uiFieldRefs(key.kind, text) }),
  meta: (text, key) => ({ where: key.where, name: key.name, fieldUses: metaFieldRefs(key.file, text) }),
};

/** Parses one file. Returns { type, data } or null; never throws. */
function parseFile(file, text) {
  const key = classify(file);
  if (!key) return null;
  key.file = String(file).split(/[\\/]/).join('/');
  try {
    const data = PARSERS[key.type](text, key);
    if (/^(layout|listView|compactLayout|permission|recordType|customMetadataRecord|workflow)$/.test(key.type)) data.fieldUses = metaFieldRefs(key.file, text);
    return { type: key.type, data };
  } catch (error) {
    return { type: key.type, error: `${path.basename(file)}: ${error.message}` };
  }
}

module.exports = { classify, parseFile, formulaRefs };
