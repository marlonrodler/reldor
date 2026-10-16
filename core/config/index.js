'use strict';

const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const RELDOR_DIR = '.reldor';
const CONFIG_FILE = 'reldor.config.yaml';
const PROFILE_FILE = 'profile.md';

/** Sensible defaults: the Reldor works even without a config file. */
const DEFAULTS = Object.freeze({
  language: 'pt-BR',
  modules: ['sf'],
  environments: [],
  reference_org: null,
  index: { refresh_hours: 24, depth: 2 },
  spec: { generator: null, path: '.kiro/specs' },
  // actions: off = Reldor only checks and advises; your own flow (e.g. the team's workflow plugin) creates branches, commits,
  // merges and PRs. on = Reldor may also commit, with confirmation.
  git: { actions: 'off', clean_commit: true, pre_commit_hook: true, smart_merge: 'suggest', rerere: true },
  advisors: { mode: 'ask', enabled: ['spec-review', 'automation-design', 'lwc-ux'], design_system: null },
  test_radar: { auto_run: 'ask' },
  automations: [],
  connectors: {},
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, override) {
  if (!isPlainObject(override)) return override === undefined ? base : override;
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
  }
  return result;
}

/** Walks up from `start` until it finds a Git or Salesforce project root. */
function findProjectRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'sfdx-project.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

function paths(root) {
  const base = path.join(root, RELDOR_DIR);
  return {
    base,
    config: path.join(base, CONFIG_FILE),
    profile: path.join(base, PROFILE_FILE),
    cache: path.join(base, 'cache'),
    work: path.join(base, 'work'),
    log: path.join(base, 'log'),
  };
}

/** Loads the project config merged over the defaults. */
function loadConfig(root) {
  const file = paths(root).config;
  if (!fs.existsSync(file)) return { config: { ...DEFAULTS }, exists: false, file };
  const raw = fs.readFileSync(file, 'utf8');
  let parsed;
  try {
    parsed = YAML.parse(raw) || {};
  } catch (error) {
    const err = new Error(`Não consegui ler ${CONFIG_FILE}: ${error.message}`);
    err.code = 'CONFIG_INVALID';
    throw err;
  }
  return { config: deepMerge(DEFAULTS, parsed), exists: true, file };
}

function saveConfig(root, config) {
  const p = paths(root);
  fs.mkdirSync(p.base, { recursive: true });
  const header = '# Configuração do Reldor. Tudo é opcional; valores ausentes usam o padrão.\n';
  fs.writeFileSync(p.config, header + YAML.stringify(config), 'utf8');
  return p.config;
}

/** True when Reldor may run Git actions itself (commit, branch, merge). */
function gitActionsOn(config) {
  return String(config?.git?.actions || 'off').toLowerCase() === 'on';
}

module.exports = { gitActionsOn, DEFAULTS, RELDOR_DIR, findProjectRoot, paths, loadConfig, saveConfig, deepMerge };
