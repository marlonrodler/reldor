'use strict';

/**
 * Organizer rules per metadata type (the XML root element).
 * sections: repeated child element -> the child tags that identify one entry.
 * sort: sort entries of a section by their key. Picklist-like values keep their order (sort: false).
 * sortSections: also order the top-level sections alphabetically (as Salesforce retrieves them).
 */
const PERMISSIONS = {
  applicationVisibilities: ['application'],
  classAccesses: ['apexClass'],
  customMetadataTypeAccesses: ['name'],
  customPermissions: ['name'],
  customSettingAccesses: ['name'],
  externalDataSourceAccesses: ['externalDataSource'],
  fieldPermissions: ['field'],
  flowAccesses: ['flow'],
  layoutAssignments: ['layout', 'recordType'],
  objectPermissions: ['object'],
  pageAccesses: ['apexPage'],
  recordTypeVisibilities: ['recordType'],
  tabSettings: ['tab'],
  tabVisibilities: ['tab'],
  userPermissions: ['name'],
};

const RULES = {
  Profile: { sections: PERMISSIONS, sort: true, sortSections: true },
  PermissionSet: { sections: PERMISSIONS, sort: true, sortSections: true },
  MutingPermissionSet: { sections: PERMISSIONS, sort: true, sortSections: true },
  CustomLabels: { sections: { labels: ['fullName'] }, sort: true },
  Translations: {
    sections: { customApplications: ['name'], customLabels: ['name'], customPageWebLinks: ['name'], customTabs: ['name'], flowDefinitions: ['fullName'], quickActions: ['name'], reportTypes: ['name'], scontrols: ['name'] },
    sort: true,
  },
  SharingRules: { sections: { sharingCriteriaRules: ['fullName'], sharingOwnerRules: ['fullName'], sharingGuestRules: ['fullName'], sharingTerritoryRules: ['fullName'] }, sort: true },
  GlobalValueSet: { sections: { customValue: ['fullName'] }, sort: false },
  StandardValueSet: { sections: { standardValue: ['fullName'] }, sort: false },
  CustomObjectTranslation: { sections: { fields: ['name'], layouts: ['layout'], quickActions: ['name'], recordTypes: ['name'], sharingReasons: ['name'], validationRules: ['name'], webLinks: ['name'], workflowTasks: ['name'] }, sort: true },
  Package: { sections: { types: ['name'] }, sort: true, packageXml: true },
};

/** Which files the organizer handles, by file name. */
function isOrganizable(file) {
  return /\.(profile|permissionset|mutingpermissionset|labels|translation|sharingRules|globalValueSet|standardValueSet|objectTranslation)-meta\.xml$/i.test(file) || /(^|[\\/])package\.xml$/i.test(file);
}

module.exports = { RULES, isOrganizable };
