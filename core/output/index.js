'use strict';

/**
 * The answer of every command is also saved in .reldor/work/output/<command>.<json|txt> (out of Git). When the IDE
 * terminal mixes up or loses the output, the AI reads that file instead of running the command again. One file per
 * command, always overwritten; the folder is emptied when the task or its phase changes, and files older than 7 days go.
 */
const fs = require('node:fs');
const path = require('node:path');

const SKIP = new Set(['help', 'version', 'merge-driver', 'precommit', 'setup', 'output']);
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const dirOf = (root) => path.join(root, '.reldor', 'work', 'output');

/** Is this a project folder (so the file goes next to the project, not anywhere)? */
function isProject(root) {
  return fs.existsSync(path.join(root, 'sfdx-project.json')) || fs.existsSync(path.join(root, '.reldor'));
}

/** Removes every output file. */
function clearOutput(root) {
  const dir = dirOf(root);
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir).filter((f) => f !== '.state.json');
  for (const f of files) fs.rmSync(path.join(dir, f), { force: true });
  return files.length;
}

/** Empties the folder when the task or the phase changed since the last save, and drops old files. */
function tidy(root) {
  const dir = dirOf(root);
  if (!fs.existsSync(dir)) return;
  let now = { task: null, phase: null };
  try {
    const gitApi = require('../git');
    const { loadConfig, baseBranch } = require('../config');
    const { config } = loadConfig(root);
    const repo = gitApi.isRepo(root);
    const branch = repo ? gitApi.currentBranch(root) : null;
    // The same phase the status shows: pending changes → develop, commits ahead of the base → promote.
    const pending = repo ? Object.values(gitApi.pendingChanges(root)).reduce((n, l) => n + l.filter((f) => !f.startsWith('.reldor/')).length, 0) : 0;
    const base = baseBranch(config);
    const ahead = repo && base && base !== branch ? Number(gitApi.git(root, ['rev-list', '--count', `${base}..HEAD`]).stdout) || 0 : 0;
    const t = require('../task').currentTask(root, config, { branch, pending, ahead, remember: false });
    now = { task: t.id, phase: t.phase };
  } catch {
    /* without the task, only the age rule */
  }
  const stateFile = path.join(dir, '.state.json');
  let before = {};
  try {
    before = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    /* first time */
  }
  if (before.task !== undefined && (before.task !== now.task || before.phase !== now.phase)) clearOutput(root);
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    try {
      if (f !== '.state.json' && Date.now() - fs.statSync(full).mtimeMs > MAX_AGE) fs.rmSync(full, { force: true });
    } catch {
      /* ignore */
    }
  }
  fs.writeFileSync(stateFile, JSON.stringify(now));
}

/** Saves the answer of one command. Never fails the command. */
function saveOutput(root, command, text, { json = false } = {}) {
  try {
    // Through MCP the answer already goes straight to the AI: nothing to keep.
    if (!command || SKIP.has(command) || process.env.RELDOR_VIA_MCP || !isProject(root)) return null;
    const dir = dirOf(root);
    fs.mkdirSync(dir, { recursive: true });
    tidy(root);
    const file = path.join(dir, `${command.replace(/[^\w-]/g, '_')}.${json ? 'json' : 'txt'}`);
    fs.writeFileSync(file, text);
    return file;
  } catch {
    return null;
  }
}

module.exports = { saveOutput, clearOutput, tidy, dirOf };
