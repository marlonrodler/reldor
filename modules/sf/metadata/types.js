'use strict';

/**
 * Source-format path -> Metadata API type and member name, for package.xml and destructiveChanges.xml.
 * Covers the types a Salesforce team changes day to day; unknown paths return null.
 */
const BY_FOLDER = [
  [/\/classes\/([^/]+)\.cls$/, 'ApexClass'],
  [/\/triggers\/([^/]+)\.trigger$/, 'ApexTrigger'],
  [/\/pages\/([^/]+)\.page$/, 'ApexPage'],
  [/\/components\/([^/]+)\.component$/, 'ApexComponent'],
  [/\/flows\/([^/]+)\.flow-meta\.xml$/, 'Flow'],
  [/\/layouts\/([^/]+)\.layout-meta\.xml$/, 'Layout'],
  [/\/permissionsets\/([^/]+)\.permissionset-meta\.xml$/, 'PermissionSet'],
  [/\/permissionsetgroups\/([^/]+)\.permissionsetgroup-meta\.xml$/, 'PermissionSetGroup'],
  [/\/profiles\/([^/]+)\.profile-meta\.xml$/, 'Profile'],
  [/\/customMetadata\/([^/]+)\.md-meta\.xml$/, 'CustomMetadata'],
  [/\/flexipages\/([^/]+)\.flexipage-meta\.xml$/, 'FlexiPage'],
  [/\/tabs\/([^/]+)\.tab-meta\.xml$/, 'CustomTab'],
  [/\/staticresources\/([^/.]+)[^/]*$/, 'StaticResource'],
  [/\/quickActions\/([^/]+)\.quickAction-meta\.xml$/, 'QuickAction'],
  [/\/customPermissions\/([^/]+)\.customPermission-meta\.xml$/, 'CustomPermission'],
  [/\/namedCredentials\/([^/]+)\.namedCredential-meta\.xml$/, 'NamedCredential'],
  [/\/globalValueSets\/([^/]+)\.globalValueSet-meta\.xml$/, 'GlobalValueSet'],
  [/\/queues\/([^/]+)\.queue-meta\.xml$/, 'Queue'],
  [/\/groups\/([^/]+)\.group-meta\.xml$/, 'Group'],
  [/\/applications\/([^/]+)\.app-meta\.xml$/, 'CustomApplication'],
  [/\/reportTypes\/([^/]+)\.reportType-meta\.xml$/, 'ReportType'],
  [/\/emailTemplates?\/(.+)\.email$/, 'EmailTemplate'],
  [/\/lwc\/([^/]+)\//, 'LightningComponentBundle'],
  [/\/aura\/([^/]+)\//, 'AuraDefinitionBundle'],
  [/\/sharingRules\/([^/]+)\.sharingRules-meta\.xml$/, 'SharingRules'],
  [/\/workflows\/([^/]+)\.workflow-meta\.xml$/, 'Workflow'],
];

const OBJECT_CHILDREN = {
  fields: ['CustomField', 'field'],
  validationRules: ['ValidationRule', 'validationRule'],
  recordTypes: ['RecordType', 'recordType'],
  listViews: ['ListView', 'listView'],
  compactLayouts: ['CompactLayout', 'compactLayout'],
  webLinks: ['WebLink', 'webLink'],
  businessProcesses: ['BusinessProcess', 'businessProcess'],
  fieldSets: ['FieldSet', 'fieldSet'],
};

function memberOf(file) {
  const p = `/${String(file).split('\\').join('/')}`;
  let m = /\/objects\/([^/]+)\/([^/]+)\/([^/]+?)\.([A-Za-z]+)-meta\.xml$/.exec(p);
  if (m && OBJECT_CHILDREN[m[2]]) return { type: OBJECT_CHILDREN[m[2]][0], member: `${m[1]}.${m[3]}` };
  m = /\/objects\/([^/]+)\/\1\.object-meta\.xml$/.exec(p);
  if (m) return { type: 'CustomObject', member: m[1] };
  if (/\/labels\/[^/]+\.labels-meta\.xml$/.test(p)) return { type: 'CustomLabels', member: 'CustomLabels', container: true };
  for (const [re, type] of BY_FOLDER) {
    m = re.exec(p);
    if (m) return { type, member: m[1] };
  }
  return null;
}

/** package.xml / destructiveChanges.xml text for a list of { type, member }. */
function manifest(items, apiVersion = '61.0') {
  const byType = new Map();
  for (const { type, member } of items) {
    if (!byType.has(type)) byType.set(type, new Set());
    byType.get(type).add(member);
  }
  const types = [...byType.keys()].sort().map((t) => `    <types>\n${[...byType.get(t)].sort().map((m) => `        <members>${m}</members>`).join('\n')}\n        <name>${t}</name>\n    </types>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n${types.join('\n')}${types.length ? '\n' : ''}    <version>${apiVersion}</version>\n</Package>\n`;
}

module.exports = { memberOf, manifest };
