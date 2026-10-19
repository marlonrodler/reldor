'use strict';

const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  htmlEntities: true, // numeric entities such as &#39; come back as the character (v4 did this by default)
  isArray: (name) => ARRAY_TAGS.has(name),
});

/** Tags that may repeat; always read as arrays so the parsers stay simple. */
const ARRAY_TAGS = new Set([
  'value', 'filters', 'recordUpdates', 'recordCreates', 'recordDeletes', 'recordLookups', 'actionCalls',
  'subflows', 'inputAssignments', 'scheduledPaths', 'processMetadataValues', 'rules', 'fieldUpdates',
  'actions', 'referenceTo', 'assignments', 'assignmentItems', 'decisions', 'rules',
]);

function parseXml(text) {
  return parser.parse(text);
}

/** Salesforce XML booleans come as strings. */
function bool(value) {
  return value === true || value === 'true';
}

function arr(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = { parseXml, bool, arr };
