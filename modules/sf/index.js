'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { run } = require('../../core/util/exec');

const name = 'sf';
const label = 'Salesforce';
const projectMarker = 'sfdx-project.json';

function readProject(root) {
  const file = path.join(root, 'sfdx-project.json');
  if (!fs.existsSync(file)) return null;
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const dirs = (json.packageDirectories || []).map((d) => d.path).filter(Boolean);
    return { packageDirectories: dirs.length ? dirs : ['force-app'], apiVersion: json.sourceApiVersion || null, namespace: json.namespace || null };
  } catch {
    return { packageDirectories: ['force-app'], apiVersion: null, invalid: true };
  }
}

function matches(root) {
  return fs.existsSync(path.join(root, 'sfdx-project.json'));
}

/** The sf CLI on the PATH, found without running it (running `sf` takes seconds, more on Windows). */
function findSf(env = process.env) {
  const names = process.platform === 'win32' ? ['sf.cmd', 'sf.exe', 'sf.ps1', 'sf'] : ['sf'];
  for (const dir of String(env.PATH || env.Path || '').split(path.delimiter).filter(Boolean)) {
    for (const n of names) {
      const full = path.join(dir, n);
      try {
        if (fs.statSync(full).isFile()) return full;
      } catch {
        /* not here */
      }
    }
  }
  return null;
}

/** Version of the sf CLI read from its package.json next to the executable, or null. */
function sfVersion(file) {
  const tries = [];
  try {
    let dir = path.dirname(fs.realpathSync(file));
    for (let i = 0; i < 4; i += 1) {
      tries.push(path.join(dir, 'package.json'), path.join(dir, 'node_modules', '@salesforce', 'cli', 'package.json'), path.join(dir, 'client', 'package.json'));
      dir = path.dirname(dir);
    }
  } catch {
    return null;
  }
  for (const f of tries) {
    try {
      const pkg = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (pkg.name === '@salesforce/cli') return pkg.version;
    } catch {
      /* next */
    }
  }
  return null;
}

/** Is the sf CLI installed, and which version (fast: no process is started). */
function sfCli(env = process.env) {
  const file = findSf(env);
  return file ? { installed: true, version: sfVersion(file) } : { installed: false };
}

/** The default org, read from the environment and the sf config files (no process is started). */
function defaultOrg(root) {
  return process.env.SF_TARGET_ORG || configuredOrg(root);
}

/** Walks the package directories looking for Apex framework markers. Bounded to stay fast. */
function detectFrameworks(root, packageDirectories, limit = 20000) {
  const found = { fflib: false, triggerHandler: false, apexClasses: 0, triggers: 0, lwc: 0 };
  let seen = 0;
  const stack = packageDirectories.map((d) => path.join(root, d)).filter((d) => fs.existsSync(d));
  while (stack.length && seen < limit) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      seen += 1;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'lwc') {
          try {
            found.lwc += fs.readdirSync(full, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
          } catch {
            /* ignore */
          }
        }
        stack.push(full);
        continue;
      }
      if (entry.name.endsWith('.cls')) {
        found.apexClasses += 1;
        if (/^fflib_/i.test(entry.name)) found.fflib = true;
        if (/TriggerHandler\.cls$/i.test(entry.name)) found.triggerHandler = true;
      } else if (entry.name.endsWith('.trigger')) {
        found.triggers += 1;
      }
    }
  }
  if (!found.fflib) found.fflib = hasFflibApplication(root, packageDirectories);
  return found;
}

/** Projects may use fflib from a package; the Application class still references it. */
function hasFflibApplication(root, packageDirectories) {
  for (const dir of packageDirectories) {
    const candidates = [
      path.join(root, dir, 'main', 'default', 'classes', 'Application.cls'),
      path.join(root, dir, 'classes', 'Application.cls'),
    ];
    for (const file of candidates) {
      if (fs.existsSync(file) && /fflib_Application/.test(fs.readFileSync(file, 'utf8'))) return true;
    }
  }
  return false;
}

/** Facts about the Salesforce project. `options.skipCli` avoids calling `sf` (tests, speed). */
function detect(root, options = {}) {
  const project = readProject(root);
  const cli = options.skipCli ? { installed: null } : sfCli();
  const org = !options.skipCli && cli.installed ? defaultOrg(root) : null;
  const frameworks = project ? detectFrameworks(root, project.packageDirectories) : null;
  return { module: name, project, cli, defaultOrg: org, frameworks };
}

function statusLines(facts) {
  const lines = [];
  if (!facts.project) {
    lines.push('⚠️ sfdx-project.json não encontrado: este não parece um projeto Salesforce.');
    return lines;
  }
  if (facts.cli.installed === false) lines.push('⚠️ Salesforce CLI (sf) não encontrado. Instale para usar retrieve, deploy e testes.');
  else if (facts.cli.installed) lines.push(`• Salesforce CLI ${facts.cli.version || ''}`.trim());
  if (facts.cli.installed) {
    lines.push(facts.defaultOrg ? `• Org padrão: ${facts.defaultOrg}` : '• Nenhuma org padrão definida no sf CLI');
  }
  const f = facts.frameworks;
  if (f) {
    const fw = [f.fflib && 'fflib', f.triggerHandler && 'TriggerHandler'].filter(Boolean).join(', ') || 'nenhum detectado';
    lines.push(`• ${f.apexClasses} classe(s) Apex, ${f.triggers} trigger(s), ${f.lwc} LWC(s) · framework: ${fw}`);
  }
  return lines;
}

function profileLines(facts) {
  if (!facts.project) return [];
  const f = facts.frameworks || {};
  return [
    '## Salesforce',
    `- Pastas de pacote: ${facts.project.packageDirectories.join(', ')}`,
    `- Versão da API: ${facts.project.apiVersion || 'não definida'}`,
    `- Framework Apex: ${f.fflib ? 'fflib (Domain / Selector / Service)' : f.triggerHandler ? 'TriggerHandler' : 'não detectado'}`,
    `- Tamanho: ${f.apexClasses || 0} classes Apex, ${f.triggers || 0} triggers, ${f.lwc || 0} LWCs`,
  ];
}


/**
 * Warnings for `reldor status`: what would make the pipeline fail if the branch went to the next environment now
 * (missing dependencies, commit order, other people's commits). Conflicts are not warned: `reldor merge` resolves them.
 * Quiet by design: returns only real problems. Cached per commit, so it costs nothing the second time.
 */
function alerts(root, config, status) {
  if (!status.git.repo || !status.environments.configured) return [];
  const next = status.environments.items.find((i) => i.state === 'missing');
  if (!next || !next.ref) return [];
  const gitApi = require('../../core/git');
  const head = gitApi.git(root, ['rev-parse', 'HEAD']).stdout;
  const target = gitApi.git(root, ['rev-parse', next.ref]).stdout;
  const cacheFile = path.join(root, '.reldor', 'cache', 'alerts.json');
  const key = `${head}|${target}|${next.name}`;
  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cached.key === key && Date.now() - cached.at < 30 * 60 * 1000) return cached.alerts;
  } catch {
    /* no cache */
  }
  const { rehearse } = require('./promote');
  const out = [];
  const r = rehearse(root, config, { env: next.name, quick: true });
  const to = `para ${next.name}`;
  if (r.notInPrevious.length) out.push({ level: 'alta', text: `${r.notInPrevious.length} commit(s) ainda não passaram por ${r.previous}: a esteira bloqueia ${to}.` });
  for (const m of r.missing) out.push({ level: 'alta', text: `${m.kind} ${m.item} não existe em ${next.name}${m.presentIn.length ? ` (só em ${m.presentIn.join(', ')})` : ''}, e a sua mudança usa (${m.files.map((f) => path.basename(f)).join(', ')}).` });
  if (r.foreign) out.push({ level: 'média', text: `${r.foreign.commits.length} commit(s) de outras pessoas iriam junto ${to}.` });
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify({ key, at: Date.now(), alerts: out }));
  } catch {
    /* cache is best effort */
  }
  return out;
}

/**
 * reldor doctor: what Salesforce work needs on this machine. The sf CLI is required inside a Salesforce project
 * (retrieve, running tests); the Code Analyzer is optional (official rules in the review).
 */
function doctorChecks(root, { inProject } = {}) {
  const checks = [];
  // One sf call (each one takes seconds on Windows): the version and the installed plugins together.
  const res = run('sf', ['version', '--verbose', '--json'], { timeout: 60000 });
  let info = null;
  try {
    info = res.ok ? JSON.parse(res.stdout) : null;
  } catch {
    info = null;
  }
  if (!info) {
    checks.push({ id: 'sf', label: 'Salesforce CLI', state: inProject ? 'missing' : 'optional', required: Boolean(inProject), detail: 'não encontrado', fix: 'npm install --global @salesforce/cli' });
    return checks;
  }
  checks.push({ id: 'sf', label: 'Salesforce CLI', state: 'ok', required: Boolean(inProject), detail: String(info.cliVersion || '').replace(/^@salesforce\/cli\//, '') });
  const analyzer = (info.pluginVersions || []).some((v) => /^(@salesforce\/(plugin-)?)?code-analyzer\s/i.test(String(v)));
  checks.push(analyzer
    ? { id: 'code-analyzer', label: 'Code Analyzer (opcional)', state: 'ok', required: false, detail: 'instalado' }
    : { id: 'code-analyzer', label: 'Code Analyzer (opcional)', state: 'optional', required: false, detail: 'não instalado: o review roda sem as regras oficiais do PMD', fix: 'sf plugins install code-analyzer (precisa de Java 11+)' });
  if (inProject) {
    const org = configuredOrg(root);
    checks.push(org
      ? { id: 'org', label: 'Org padrão do projeto', state: 'ok', required: false, detail: org }
      : { id: 'org', label: 'Org padrão do projeto', state: 'optional', required: false, detail: 'nenhuma: só precisa para retrieve e para rodar testes', fix: 'sf org login web --alias <apelido> --set-default' });
  }
  return checks;
}

/** The default org read from the sf config files (project first, then global), without calling the sf CLI. */
function configuredOrg(root, home = require('node:os').homedir()) {
  const read = (file, key) => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))[key] || null;
    } catch {
      return null;
    }
  };
  return read(path.join(root, '.sf', 'config.json'), 'target-org') || read(path.join(root, '.sfdx', 'sfdx-config.json'), 'defaultusername')
    || read(path.join(home, '.sf', 'config.json'), 'target-org') || read(path.join(home, '.sfdx', 'sfdx-config.json'), 'defaultusername');
}

const { CAPABILITIES: capabilities, detectTools } = require('./tools');

/** The automatic part of profile.md, read from the project index (see ./profile.js). */
function profileAuto(root) {
  return require('./profile').profileAuto(root);
}

module.exports = {
  sfCli, findSf,
  capabilities, detectTools, alerts, name, label, projectMarker, matches, detect, statusLines, profileLines, profileAuto, doctorChecks, configuredOrg, readProject };
