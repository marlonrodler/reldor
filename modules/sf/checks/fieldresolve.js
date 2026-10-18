'use strict';

/**
 * Query-time half of the field references (see indexer/fieldrefs.js): turns a reference's base and path into the
 * object the field belongs to, using the lookups and child relationships the index knows.
 */

// Standard lookups and child relationships that are not in the project's metadata.
const STD_PARENT = {
  owner: 'User', createdby: 'User', lastmodifiedby: 'User', manager: 'User', delegatedapprover: 'User', user: 'User',
  account: 'Account', contact: 'Contact', opportunity: 'Opportunity', case: 'Case', lead: 'Lead', campaign: 'Campaign',
  product2: 'Product2', pricebook2: 'Pricebook2', pricebookentry: 'PricebookEntry', recordtype: 'RecordType', profile: 'Profile',
  userrole: 'UserRole', contract: 'Contract', order: 'Order', asset: 'Asset', quote: 'Quote', individual: 'Individual',
  reportsto: 'Contact', masterrecord: null, convertedaccount: 'Account', convertedcontact: 'Contact', convertedopportunity: 'Opportunity',
};
const STD_CHILD = {
  contacts: 'Contact', opportunities: 'Opportunity', cases: 'Case', tasks: 'Task', events: 'Event', attachments: 'Attachment',
  notes: 'Note', opportunitylineitems: 'OpportunityLineItem', campaignmembers: 'CampaignMember', accountcontactrelations: 'AccountContactRelation',
  contentdocumentlinks: 'ContentDocumentLink', users: 'User', assets: 'Asset', contracts: 'Contract', orders: 'Order', orderitems: 'OrderItem',
  quotes: 'Quote', childaccounts: 'Account', opportunitycontactroles: 'OpportunityContactRole', accountteammembers: 'AccountTeamMember',
  openactivities: 'OpenActivity', activityhistories: 'ActivityHistory', partners: 'Partner', entitlements: 'Entitlement',
};
const STANDARD = new Set([
  'Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Campaign', 'CampaignMember', 'Task', 'Event', 'User', 'Product2', 'Pricebook2',
  'PricebookEntry', 'OpportunityLineItem', 'Contract', 'Order', 'OrderItem', 'Asset', 'Quote', 'QuoteLineItem', 'Individual',
  'ContentVersion', 'ContentDocument', 'ContentDocumentLink', 'Attachment', 'Note', 'RecordType', 'Profile', 'UserRole', 'Group',
  'AccountContactRelation', 'OpportunityContactRole', 'Entitlement', 'ServiceContract', 'WorkOrder', 'Knowledge__kav', 'EmailMessage',
  'Organization', 'PermissionSet', 'Document', 'Folder', 'Report', 'Dashboard', 'Partner', 'Solution',
]);

/** The object's name as the model spells it, or the name itself when it looks like an sObject; else null. */
function objectName(model, name) {
  if (!name) return null;
  const lower = String(name).toLowerCase();
  const hit = Object.keys(model.objects).find((o) => o.toLowerCase() === lower);
  if (hit) return hit;
  const std = [...STANDARD].find((o) => o.toLowerCase() === lower);
  if (std) return std;
  if (/__(c|mdt|e|x|b|kav)$/i.test(name)) return name;
  return null;
}

/** Child object of a child relationship name (Contacts, Projects__r) under a parent object. */
function childObject(model, parent, rel) {
  const r = String(rel).toLowerCase();
  const p = String(parent).toLowerCase();
  for (const o of Object.values(model.objects)) {
    for (const f of Object.values(o.fields)) {
      if (!f.referenceTo || String(f.referenceTo).toLowerCase() !== p) continue;
      const relName = (f.relationshipName || '').toLowerCase();
      if (relName === r || `${relName}__r` === r) return o.name;
    }
  }
  return STD_CHILD[r] || null;
}

/** Follows path segments (all but the last) from an object. Returns the object of the last segment or null. */
function walkPath(model, start, segments, preferChild = false) {
  let current = start;
  for (const seg of segments) {
    const o = model.objects[current];
    const lower = seg.toLowerCase();
    let next = null;
    // Report type tables are joins to children: Program__c.Projects__r means the child relationship
    if (preferChild) next = childObject(model, current, seg);
    if (!next && o) {
      const lookup = Object.values(o.fields).find((f) => f.referenceTo && (f.name.toLowerCase() === lower.replace(/__r$/, '__c') || (f.relationshipName || '').toLowerCase() === lower || `${(f.relationshipName || '').toLowerCase()}__r` === lower));
      if (lookup) next = objectName(model, lookup.referenceTo) || lookup.referenceTo;
    }
    if (!next && lower === 'parent') next = current;
    if (!next) next = childObject(model, current, seg); // Contact.Program_Engagements__r (reports, report types)
    if (!next && lower in STD_PARENT) next = STD_PARENT[lower];
    if (!next) return null;
    current = next;
  }
  return current;
}

/** Objects of the project that have a field with this name. */
function objectsWithField(model, field) {
  const lower = String(field).toLowerCase();
  if (!model._fieldOwners) {
    model._fieldOwners = new Map();
    for (const o of Object.values(model.objects)) {
      for (const f of Object.keys(o.fields)) {
        const k = f.toLowerCase();
        if (!model._fieldOwners.has(k)) model._fieldOwners.set(k, []);
        model._fieldOwners.get(k).push(o.name);
      }
    }
  }
  return model._fieldOwners.get(lower) || [];
}

/** Element type of a declared type (List<Account> -> Account). */
function elementType(type) {
  return require('../indexer/fieldrefs').elementType(type || '');
}

/** Objects a screen component works with: its imports, the sObjects its Apex methods return, its controllers. */
function screenObjects(model, screen) {
  const out = new Set();
  const add = (n) => {
    const o = objectName(model, elementType(n));
    if (o) out.add(o);
  };
  for (const o of screen.context.objects) add(o);
  for (const t of Object.values(screen.context.types || {})) add(t);
  for (const a of screen.context.apex) {
    const [cls, method] = a.split('.');
    const c = model.classes[cls];
    const ret = c && c.methodReturns && method ? c.methodReturns[method.toLowerCase()] : null;
    if (ret) add(ret);
  }
  for (const ctrl of screen.context.controllers) {
    const c = model.classes[ctrl];
    if (!c) {
      add(ctrl); // standardController="Account"
      continue;
    }
    for (const t of Object.values(c.propertyTypes || {})) add(t);
    for (const t of Object.values(c.methodReturns || {})) add(t);
  }
  return out;
}

/**
 * What a relationship name can point to, anywhere in the project: the parents of lookups called that way
 * (Parent__r -> lookup Parent__c) and the children whose lookup has that child relationship name.
 */
function relTargets(model, rel) {
  const r = String(rel).toLowerCase();
  const lookup = r.replace(/__r$/, '__c');
  const parents = new Set();
  const children = new Set();
  for (const o of Object.values(model.objects)) {
    for (const f of Object.values(o.fields)) {
      if (!f.referenceTo) continue;
      if (f.name.toLowerCase() === lookup) parents.add(objectName(model, f.referenceTo) || f.referenceTo);
      const rn = (f.relationshipName || '').toLowerCase();
      if (rn && (rn === r || `${rn}__r` === r)) children.add(o.name);
    }
  }
  return { parents, children, child: children.size === 1 ? [...children][0] : null };
}

/** Inner classes of every class, by name; a name declared in two classes is left out (cannot tell which). */
function innerTypes(model) {
  if (model._inner) return model._inner;
  const map = new Map();
  const twice = new Set();
  for (const c of Object.values(model.classes)) {
    for (const [name, types] of Object.entries(c.innerPropertyTypes || {})) {
      if (map.has(name)) twice.add(name);
      else map.set(name, types);
    }
  }
  for (const n of twice) map.delete(n);
  model._inner = map;
  return map;
}

/** Follows class properties (Wrapper.record.Parent__r) to an object. */
function classPathObject(model, cls, segments, owner = null) {
  let current = cls;
  const via = [];
  const inner = innerTypes(model);
  for (let i = 0; i < segments.length; i += 1) {
    // Inside a class, its own inner classes come first (Apex resolves them before top-level classes).
    const own = owner && owner.innerPropertyTypes && owner.innerPropertyTypes[String(current).toLowerCase()];
    const c = (own && { propertyTypes: own }) || model.classes[current] || (inner.get(String(current).toLowerCase()) ? { propertyTypes: inner.get(String(current).toLowerCase()) } : null);
    if (!c) {
      const obj = objectName(model, current);
      if (!obj) return null;
      const end = walkPath(model, obj, segments.slice(i));
      return end ? { object: end, via: via.join('.') } : null;
    }
    const t = (c.propertyTypes || {})[segments[i].toLowerCase()];
    if (!t) return null;
    current = elementType(t);
    via.push(`${segments[i]} (${current})`);
  }
  const obj = objectName(model, current);
  return obj ? { object: obj, via: via.join('.') } : null;
}

/**
 * The object of one reference: { object, how, candidates }. object null = cannot say; candidates then lists the
 * objects of the project that have a field with that name.
 */
function resolveFieldRef(model, ref, screen = null, owner = null) {
  const owners = objectsWithField(model, ref.field);
  let base = ref.base;
  let how = ref.how;
  // Visualforce/Aura merge field whose head is a controller property: {!conta.Score__c}
  if (screen && ref.mergeHead && !objectName(model, base)) {
    let typed = null;
    for (const ctrl of screen.context.controllers) {
      const c = model.classes[ctrl];
      const t = c && c.propertyTypes && c.propertyTypes[ref.mergeHead.toLowerCase()];
      if (t) typed = elementType(t);
    }
    base = typed;
    if (typed) how = `propriedade ${ref.mergeHead} (${typed}) do controller`;
  }
  let object = null;
  if (base && String(base).startsWith('ret:')) {
    // The return type of a method of another class: UTIL_CustomSettingsFacade.getSettings().Field__c
    const [cls, method] = base.slice(4).split('.');
    const c = model.classes[cls] || Object.values(model.classes).find((x) => x.name.toLowerCase() === cls.toLowerCase());
    const ret = c && c.methodReturns ? c.methodReturns[String(method).toLowerCase()] : null;
    const start = ret ? objectName(model, elementType(ret)) : null;
    object = start ? walkPath(model, start, ref.path.slice(0, -1)) : null;
    if (object) how = `${how} (${elementType(ret)})`;
    base = null;
  } else if (base && String(base).startsWith('rel:')) {
    const [, parent, rel] = base.split(':');
    // A semi-join (WHERE Id IN (SELECT Field__c FROM Other__c)) names an object; a subquery names a relationship.
    const child = objectName(model, rel) || (parent ? childObject(model, objectName(model, parent) || parent, rel) : relTargets(model, rel).child);
    object = child ? walkPath(model, child, ref.path.slice(0, -1)) : null;
    if (object) how = `${how} (subconsulta ${rel})`;
  } else if (base) {
    const start = objectName(model, base);
    // SOQL lets a field be written with its object: ProgramEngagement__c.Program__r.Status__c
    const path = ref.path.length > 1 && start && ref.path[0].toLowerCase() === start.toLowerCase() && !/__r$/i.test(ref.path[0]) ? ref.path.slice(1) : ref.path;
    if (start) object = walkPath(model, start, path.slice(0, -1), Boolean(ref.childPath));
    else if ((model.classes[base] || innerTypes(model).has(String(base).toLowerCase()) || (owner && owner.innerPropertyTypes && owner.innerPropertyTypes[String(base).toLowerCase()])) && ref.path.length > 1) {
      // A wrapper class: model.serviceSchedule.Field__c -> the type of the property serviceSchedule
      const typed = classPathObject(model, base, ref.path.slice(0, -1), owner);
      if (typed) {
        object = typed.object;
        how = `${how} → ${typed.via}`;
      }
    }
  }
  if (!object && base && /__r$/i.test(base) && !objectName(model, base)) {
    // 'General_Accounting_Unit__r.Active__c': the lookup General_Accounting_Unit__c points to one object
    const { parents, children } = relTargets(model, base);
    const targets = new Set([...parents, ...children]);
    if (targets.size === 1) {
      const start = [...targets][0];
      const end = walkPath(model, start, ref.path.slice(0, -1));
      if (end) return { object: end, how: `${how}; ${base} aponta para ${start}`, candidates: owners };
    }
  }
  if (object) return { object, how, candidates: owners };
  if (screen && (ref.contextual || ref.mergeHead || ref.viaAttribute)) {
    const ctx = screenObjects(model, screen);
    const inCtx = owners.filter((o) => ctx.has(o));
    if (inCtx.length === 1) return { object: inCtx[0], how: `${ref.how}; a tela trabalha com ${inCtx[0]}`, candidates: owners };
  }
  // A text that is exactly an object name, where the context says "object": the object, not a field.
  if (ref.bareString && model.objects[objectName(model, ref.field) || ''] && !object) {
    if (ref.contextWord && /object|entity|sobject|table/i.test(ref.contextWord) && !/field/i.test(ref.contextWord)) return { object: null, objectMention: true, how, candidates: owners };
    if (ref.mdObjects && ref.mdObjects.some((v) => v.toLowerCase() !== ref.field.toLowerCase() && Object.keys(model.objects[objectName(model, ref.field)].fields).some((f) => f.toLowerCase() === v.toLowerCase()))) {
      return { object: null, objectMention: true, how, candidates: owners }; // the record also names a field of that object
    }
  }
  if (ref.prose) return { object: null, objectMention: true, prose: true, how, candidates: owners };
  if (ref.mdObjects) {
    // A custom metadata record that names a field usually names its object in another value.
    const named = owners.filter((o) => ref.mdObjects.some((v) => v.toLowerCase() === o.toLowerCase()));
    if (named.length === 1) return { object: named[0], how: `${how}; o registro aponta o objeto ${named[0]}`, candidates: owners };
  }
  if (ref.nearStrings && ref.nearStrings.length) {
    const named = owners.filter((o) => ref.nearStrings.some((v) => v.toLowerCase() === o.toLowerCase()));
    if (named.length === 1) return { object: named[0], how: `${how}; o mesmo comando cita o objeto ${named[0]}`, candidates: owners };
  }
  if (ref.bareString && objectName(model, ref.field) && model.objects[objectName(model, ref.field)]) {
    return { object: null, how: `${how}: pode ser o nome do objeto ${ref.field}, não do campo`, candidates: owners };
  }
  if (owners.length === 1 && ref.path.length === 1) return { object: owners[0], how: `${how}; só ${owners[0]} tem esse campo no projeto`, candidates: owners };
  return { object: null, how, candidates: owners };
}

module.exports = { STANDARD, resolveFieldRef, objectsWithField, objectName, walkPath, childObject, screenObjects };
