'use strict';

/**
 * reldor doctor: is everything in place to use Reldor here, and what is the next step?
 * Checks the machine (Node.js, Git, how Reldor was installed), the folder the terminal is in (a project? a Git
 * repository? configured?) and whether an AI plugin is installed. Technology modules add their own checks through
 * the optional `doctorChecks(root)` of the module contract. Nothing is changed: it only looks.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('../util/exec');
const { paths } = require('../config');
const { REGISTRY } = require('../modules');
const pkg = require('../../package.json');

const RELDOR_HOME = path.resolve(__dirname, '..', '..');
const INSTALL_CMD = 'npm install -g github:marlonrodler/reldor';
const KIRO_URL = 'https://github.com/marlonrodler/reldor/tree/main/plugins/kiro/reldor';

/** How this copy of Reldor was installed: by npm (global) or from a cloned folder. */
function installInfo(home = RELDOR_HOME) {
  const byNpm = home.split(path.sep).includes('node_modules');
  const synced = /onedrive|dropbox|google drive|icloud/i.test(home);
  return {
    folder: home,
    mode: byNpm ? 'npm' : 'clone',
    synced,
    update: byNpm ? INSTALL_CMD : `cd "${home}" && git pull && npm install`,
  };
}

/** Node.js version, and whether it is new enough. */
function nodeCheck(version = process.versions.node) {
  const major = Number(String(version).split('.')[0]);
  const min = Number(String(pkg.engines.node).replace(/[^\d]/g, '')) || 18;
  return major >= min
    ? { id: 'node', label: 'Node.js', state: 'ok', required: true, detail: `v${version}` }
    : { id: 'node', label: 'Node.js', state: 'missing', required: true, detail: `v${version} (precisa ${min} ou mais novo)`, fix: 'winget install OpenJS.NodeJS.LTS (Windows) ou nodejs.org' };
}

/** Git installed. */
function gitCheck() {
  const res = run('git', ['--version'], { timeout: 15000 });
  return res.ok
    ? { id: 'git', label: 'Git', state: 'ok', required: true, detail: res.stdout.replace(/^git version /, '') }
    : { id: 'git', label: 'Git', state: 'missing', required: true, detail: 'não encontrado', fix: 'winget install Git.Git (Windows) ou git-scm.com' };
}

/** GitHub CLI: optional, only for reading open pull requests. */
function ghCheck() {
  const res = run('gh', ['--version'], { timeout: 15000 });
  return res.ok
    ? { id: 'gh', label: 'GitHub CLI (opcional)', state: 'ok', required: false, detail: (res.stdout.match(/gh version (\S+)/) || [])[1] || 'instalado' }
    : { id: 'gh', label: 'GitHub CLI (opcional)', state: 'optional', required: false, detail: 'não instalado: só serve para ler as pull requests abertas', fix: 'winget install GitHub.cli e depois gh auth login' };
}

/** Is any folder under `dir` (up to `depth` levels) a Reldor plugin? */
function findPlugin(dir, depth = 4) {
  if (!dir || depth < 0) return null;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name.startsWith('.git')) continue;
    const full = path.join(dir, e.name);
    if (/reldor/i.test(e.name) && ['plugin.json', 'POWER.md', path.join('.claude-plugin', 'plugin.json'), path.join('skills', 'reldor', 'SKILL.md')].some((f) => fs.existsSync(path.join(full, f)))) return full;
    const inner = findPlugin(full, depth - 1);
    if (inner) return inner;
  }
  return null;
}

/** AI plugins found on this machine (Claude Code and Kiro). Not finding one is "unknown", not an error. */
function pluginCheck(home = os.homedir()) {
  const found = [];
  const claudeList = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  try {
    if (/"reldor@/i.test(fs.readFileSync(claudeList, 'utf8'))) found.push('Claude Code');
  } catch {
    if (findPlugin(path.join(home, '.claude', 'plugins'))) found.push('Claude Code');
  }
  if (findPlugin(path.join(home, '.kiro'))) found.push('Kiro');
  return found.length
    ? { id: 'plugin', label: 'Plugin na IA', state: 'ok', required: false, detail: found.join(' e ') }
    : { id: 'plugin', label: 'Plugin na IA', state: 'unknown', required: false, detail: 'não encontrei (sem ele, você usa só pelo terminal)', fix: `Kiro: Powers → Add Custom Power → Import power from GitHub → ${KIRO_URL}. Claude Code: claude plugin marketplace add marlonrodler/reldor e claude plugin install reldor@reldor` };
}

/** The folder the terminal is in: a project, a Git repository, Reldor's own folder, configured or not. */
function folderFacts(root, cwd) {
  const projectModules = Object.keys(REGISTRY).map((n) => REGISTRY[n]()).filter((m) => typeof m.matches === 'function' && m.matches(root));
  const isReldor = path.resolve(root) === RELDOR_HOME || (fs.existsSync(path.join(root, 'package.json')) && /"name":\s*"reldor"/.test(fs.readFileSync(path.join(root, 'package.json'), 'utf8')));
  const git = run('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, timeout: 15000 });
  const markers = Object.keys(REGISTRY).map((n) => REGISTRY[n]()).filter((m) => m.projectMarker).map((m) => `um projeto ${m.label} tem o ${m.projectMarker}`);
  return {
    cwd,
    root,
    markers,
    project: projectModules.map((m) => m.label),
    modules: projectModules.map((m) => m.name),
    reldorFolder: isReldor,
    gitRepo: git.ok && git.stdout === 'true',
    configured: fs.existsSync(paths(root).config),
    toolSuggestions: 0,
  };
}

/** The one next step, from the first thing that is missing. */
function nextStep(checks, folder, plugin) {
  const missing = checks.find((c) => c.required && c.state === 'missing');
  if (missing) return `Instale ${missing.label}: ${missing.fix}. Feche e abra o terminal e rode reldor doctor de novo.`;
  if (folder.reldorFolder) return 'Este terminal está na pasta do próprio Reldor. Abra a pasta do seu projeto no VS Code (File → Open Folder), abra o terminal (Terminal → New Terminal) e rode reldor doctor lá.';
  if (!folder.project.length) return `Esta pasta não é um projeto que o Reldor conhece${folder.markers && folder.markers.length ? ` (${folder.markers.join('; ')})` : ''}. Abra a pasta do projeto no VS Code, abra o terminal ali e rode reldor doctor de novo.`;
  if (plugin.state !== 'ok') return `Ligue o Reldor na sua IA. ${plugin.fix}.`;
  if (!folder.configured) return 'Tudo instalado. Abra o chat da sua IA neste projeto e diga: "quero usar o Reldor" (ou rode reldor init).';
  if (folder.toolSuggestions) return `Tudo pronto. Encontrei ${folder.toolSuggestions} sinal(is) de ferramentas do time que já fazem o que o Reldor faz: confira com "reldor tools" para o Reldor não repetir trabalho.`;
  return 'Tudo pronto. Converse com a sua IA (ex.: "e agora?") ou rode reldor status.';
}

/** Builds the whole report. */
function buildDoctor(root, cwd = process.cwd()) {
  const install = installInfo();
  const checks = [nodeCheck(), gitCheck(), ghCheck()];
  const folder = folderFacts(root, cwd);
  for (const name of Object.keys(REGISTRY)) {
    const mod = REGISTRY[name]();
    if (typeof mod.doctorChecks === 'function') checks.push(...mod.doctorChecks(root, { inProject: folder.modules.includes(mod.name) }));
  }
  if (folder.configured && folder.project.length) {
    try {
      const { loadConfig } = require('../config');
      folder.toolSuggestions = require('../tools').toolsReport(root, loadConfig(root).config).suggestions.length;
    } catch {
      folder.toolSuggestions = 0;
    }
  }
  const plugin = pluginCheck();
  const ready = !checks.some((c) => c.required && c.state === 'missing');
  return { version: pkg.version, install, checks, plugin, folder, ready, next: nextStep(checks, folder, plugin) };
}

module.exports = { buildDoctor, installInfo, nodeCheck, pluginCheck, findPlugin, nextStep, INSTALL_CMD, KIRO_URL };
