'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { paths } = require('../config');

const LOG_FILE = 'actions.jsonl';

/** Appends one action to the local history, so nothing happens by surprise. */
function logAction(root, action, details = {}) {
  try {
    const dir = paths(root).log;
    fs.mkdirSync(dir, { recursive: true });
    const entry = { at: new Date().toISOString(), action, ...details };
    fs.appendFileSync(path.join(dir, LOG_FILE), JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // The history must never break the main command.
  }
}

/** Reads the last `limit` actions, newest first. */
function readActions(root, limit = 20) {
  const file = path.join(paths(root).log, LOG_FILE);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(-limit)
    .reverse();
}

module.exports = { logAction, readActions };
