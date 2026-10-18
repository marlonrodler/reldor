'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { run } = require('../../core/util/exec');

const name = 'sf';
const label = 'Salesforce';

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

function sfCli() {
  const res = run('sf', ['--version'], { timeout: 30000 });
  if (!res.ok) return { installed: false };
  const match = res.stdout.match(/@salesforce\/cli\/(\S+)/);
  return { installed: true, version: match ? match[1] : res.stdout.split('\n')[0] };
}

function defaultOrg(root) {
  const res = run('sf', ['config', 'get', 'target-org', '--json'], { cwd: root, timeout: 30000 });
  if (!res.ok) return null;
  try {
    const json = JSON.parse(res.stdout);
    const value = json?.result?.[0]?.value;
    return value || null;
  } catch {
    return null;
  }
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

module.exports = {
  alerts, name, label, matches, detect, statusLines, profileLines, readProject };
