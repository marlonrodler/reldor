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
  // Reldor never changes Git or the org (commit, stash, merge, retrieve, tests, deploy): it checks and hands over the
  // exact commands. Read-only org queries (limits) may run directly.
  environments: [],
  reference_org: null,
  index: { refresh_hours: 24 },
  spec: { path: '.kiro/specs' },
  // actions: off = Reldor only checks and advises; your own flow (e.g. the team's workflow plugin) creates branches, commits,
  // merges and PRs. on = Reldor may also commit, with confirmation.
  // base_branch: where development branches start (default: the production environment's branch).
  // merge_branch / rollback_branch: name patterns Reldor suggests; {feature}, {env} and {id} are filled in.
  git: { actions: 'off', base_branch: null, merge_branch: 'merge/{feature}-{env}', rollback_branch: 'rollback/{id}', rerere: true },
  advisors: { design_system: null },
  test_radar: { coverage_target: 75 },
  // tools: who takes care of each capability when another tool of the team already does it (see `reldor tools`).
  tools: {},
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

/** The production environment: the one marked `production: true`, or the last one of the chain. */
function productionEnv(config) {
  const envs = config?.environments || [];
  return envs.find((e) => e.production === true) || envs[envs.length - 1] || null;
}

/** Where development branches start: git.base_branch, or the production environment's branch. */
function baseBranch(config) {
  return config?.git?.base_branch || productionEnv(config)?.branch || null;
}

/** Fills a branch name pattern such as "merge/{feature}-{env}". */
function branchName(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (m, k) => String(vars[k] ?? '').replace(/[^\w./-]+/g, '-'));
}

/** The config file as written (without defaults), to change it without writing every default back. */
/** The person's own settings (team, prefix): .reldor/local.yaml, kept out of Git. */
function readLocal(root) {
  const file = path.join(paths(root).base, 'local.yaml');
  try {
    return YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
}

/** Saves .reldor/local.yaml and makes sure .gitignore keeps it out of the repository. */
function saveLocal(root, data) {
  const base = paths(root).base;
  fs.mkdirSync(base, { recursive: true });
  const file = path.join(base, 'local.yaml');
  fs.writeFileSync(file, `# Só seu, fora do Git: o seu time e o prefixo dele (reldor me).\n${YAML.stringify(data)}`, 'utf8');
  const ignore = path.join(root, '.gitignore');
  const current = fs.existsSync(ignore) ? fs.readFileSync(ignore, 'utf8') : '';
  if (!current.split(/\r?\n/).includes('.reldor/local.yaml')) fs.appendFileSync(ignore, `${current && !current.endsWith('\n') ? '\n' : ''}.reldor/local.yaml\n`, 'utf8');
  return file;
}

function readRawConfig(root) {
  const p = paths(root);
  if (!fs.existsSync(p.config)) return {};
  return YAML.parse(fs.readFileSync(p.config, 'utf8')) || {};
}


module.exports = { readLocal, saveLocal, productionEnv, baseBranch, branchName, readRawConfig, DEFAULTS, RELDOR_DIR, findProjectRoot, paths, loadConfig, saveConfig, deepMerge };
