'use strict';

/**
 * Run ledger: the same check over the same content runs once.
 *
 * A check is identified by its name, its options and the content of what it reads (a hash of each file), plus the
 * Reldor version. If the pre-commit hook, `reldor review` and the AI ask for the same check on the same content, only
 * the first one runs; the others reuse the stored result. Content changes the key, so a stale result is never reused.
 * Kept in .reldor/cache/runs.json (outside Git). Best effort: a broken ledger only means running again.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { paths } = require('../config');
const pkg = require('../../package.json');

const MAX_ENTRIES = 300;
let disabled = false;

/** Turns the ledger off for this process (the --fresh flag). */
function setFresh(on) {
  disabled = Boolean(on);
}

/** sha1 of a string or buffer. */
function hash(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

/** Fingerprint of files in the working tree: path + content hash, in a stable order. Missing files count too. */
function filesFingerprint(root, files) {
  return [...new Set(files)].sort().map((f) => {
    try {
      return `${f}:${hash(fs.readFileSync(path.join(root, f)))}`;
    } catch {
      return `${f}:-`;
    }
  }).join('|');
}

function ledgerFile(root) {
  return path.join(paths(root).cache, 'runs.json');
}

function readLedger(root) {
  try {
    return JSON.parse(fs.readFileSync(ledgerFile(root), 'utf8'));
  } catch {
    return {};
  }
}

function writeLedger(root, ledger) {
  try {
    const entries = Object.entries(ledger).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
    fs.mkdirSync(path.dirname(ledgerFile(root)), { recursive: true });
    fs.writeFileSync(ledgerFile(root), JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* best effort */
  }
}

/** The key of one check: its name, options and the fingerprint of what it reads. */
function runKey(check, parts) {
  return hash(JSON.stringify([pkg.version, check, parts]));
}

/**
 * Runs `fn` once per (check, parts). Returns { result, reused, at }.
 * `parts` must describe everything the result depends on (options, file fingerprints, index fingerprint).
 * `store(result)` decides whether a result is worth remembering (a failed run is not).
 */
function once(root, check, parts, fn, { store = () => true } = {}) {
  const key = runKey(check, parts);
  const ledger = disabled ? {} : readLedger(root);
  const hit = ledger[key];
  if (hit && !disabled) return { result: hit.result, reused: true, at: hit.at };
  const result = fn();
  if (!disabled && store(result)) {
    const fresh = readLedger(root);
    fresh[key] = { check, at: Date.now(), result };
    writeLedger(root, fresh);
  }
  return { result, reused: false, at: Date.now() };
}

module.exports = { once, runKey, filesFingerprint, hash, setFresh, readLedger, ledgerFile };
