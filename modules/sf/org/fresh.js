'use strict';

/**
 * Retrieve before changing: before a file that already exists is changed, it comes fresh from the reference org, so the
 * change starts from what is really there (not from an old copy in the branch). The Reldor never runs the retrieve:
 * it hands over the command, writes down how each file looked at that moment, and later checks that the files were
 * really rewritten by the retrieve. Kept per task in .reldor/work/tasks/<id>/retrieve.json (out of Git).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { memberOf } = require('../metadata/types');

// Retrieving these alone brings only part of them and would overwrite the full file in the branch.
const PARTIAL = new Set(['Profile']);

/** The task's ledger file (or one for the project when there is no task). */
function ledgerFile(root) {
  let id = null;
  try {
    const gitApi = require('../../../core/git');
    const { loadConfig } = require('../../../core/config');
    const branch = gitApi.isRepo(root) ? gitApi.currentBranch(root) : null;
    id = require('../../../core/task').currentTask(root, loadConfig(root).config, { branch, remember: false }).id;
  } catch {
    /* no task: one ledger for the project */
  }
  const dir = id ? require('../../../core/task').taskFolder(root, id) : path.join(root, '.reldor', 'work');
  return path.join(dir, 'retrieve.json');
}

function readLedger(root) {
  try {
    return JSON.parse(fs.readFileSync(ledgerFile(root), 'utf8'));
  } catch {
    return { requested: {}, fresh: {} };
  }
}

function writeLedger(root, data) {
  const file = ledgerFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const rel = (root, f) => path.relative(root, path.resolve(root, f)).split(path.sep).join('/');

/** How a file looks now: modification time and content hash (null when it does not exist). */
function look(root, file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return { mtime: fs.statSync(full).mtimeMs, hash: crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex') };
}

/**
 * Plans the retrieve of some files: which metadata to bring, which files are left out and why (uncommitted changes the
 * retrieve would overwrite, a type that comes only in part, a path that is not metadata).
 */
function planFresh(root, files, { pending = [] } = {}) {
  const busy = new Set(pending.map((f) => f.split('\\').join('/')));
  const members = new Map();
  const skipped = [];
  const take = [];
  for (const f of files) {
    const file = rel(root, f);
    const m = memberOf(file);
    if (!m) skipped.push({ file, why: 'não é um metadado do Salesforce que eu saiba trazer' });
    else if (PARTIAL.has(m.type)) skipped.push({ file, why: `${m.type} sozinho vem pela metade da org e apagaria o resto do arquivo: traga junto com o que ele usa, ou não traga` });
    else if (busy.has(file)) skipped.push({ file, why: 'tem mudança sua não commitada: o retrieve apagaria. Commite (ou guarde) antes' });
    else {
      members.set(`${m.type}:${m.member}`, m);
      take.push(file);
    }
  }
  return { metadata: [...members.keys()], files: take, skipped };
}

/** Writes down the files a retrieve was handed over for, as they look now. */
function markRequested(root, files, org) {
  const ledger = readLedger(root);
  for (const f of files) ledger.requested[f] = { ...(look(root, f) || { missing: true }), org, at: new Date().toISOString() };
  writeLedger(root, ledger);
}

/**
 * Checks the files handed over for a retrieve: a file the retrieve rewrote (or brought) is fresh; one that looks the
 * same as before was not retrieved yet.
 */
function checkFresh(root) {
  const ledger = readLedger(root);
  const done = [];
  const waiting = [];
  for (const [file, before] of Object.entries(ledger.requested || {})) {
    const now = look(root, file);
    const rewritten = now && (before.missing || now.mtime !== before.mtime || now.hash !== before.hash);
    if (rewritten) {
      ledger.fresh[file] = { org: before.org, at: new Date().toISOString(), hash: now.hash };
      delete ledger.requested[file];
      done.push(file);
    } else waiting.push(file);
  }
  writeLedger(root, ledger);
  return { done, waiting, fresh: Object.keys(ledger.fresh || {}) };
}

/** Files that already existed and were changed without coming fresh from the org first. */
function staleChanges(root, changes) {
  const ledger = readLedger(root);
  const key = (f) => {
    const m = memberOf(f);
    return m ? `${m.type}:${m.member}` : null;
  };
  // A bundle (LWC, Aura) comes whole: one fresh file makes the whole bundle fresh.
  const fresh = new Set(Object.keys(ledger.fresh || {}).map(key).filter(Boolean));
  return changes
    .filter((c) => c.status === 'modified' && memberOf(c.file) && !PARTIAL.has(memberOf(c.file).type))
    .map((c) => c.file)
    .filter((f) => !fresh.has(key(f)));
}

module.exports = { planFresh, markRequested, checkFresh, staleChanges, readLedger };
