'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'core', 'cli', 'index.js');
const { parseEnvs, suggestEnvs } = require('../core/cli/init');
const { parseArgs } = require('../core/cli');

function sh(cwd, cmd, args) {
  const res = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} falhou: ${res.stderr}`);
  return res.stdout;
}

function reldor(cwd, args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
}

/** Sample project: master, develop and rc/uat, plus a feature already promoted to develop. */
function sampleProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-'));
  sh(dir, 'git', ['init', '-q', '-b', 'master']);
  fs.writeFileSync(path.join(dir, 'sfdx-project.json'), JSON.stringify({ packageDirectories: [{ path: 'force-app' }], sourceApiVersion: '61.0' }));
  const classes = path.join(dir, 'force-app', 'main', 'default', 'classes');
  fs.mkdirSync(classes, { recursive: true });
  fs.writeFileSync(path.join(classes, 'Application.cls'), 'public class Application { fflib_Application.ServiceFactory s; }');
  fs.mkdirSync(path.join(dir, '.kiro', 'specs', 'task-123'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.kiro', 'specs', 'task-123', 'requirements.md'), '# req');
  sh(dir, 'git', ['add', '-A']);
  sh(dir, 'git', ['commit', '-qm', 'base']);
  sh(dir, 'git', ['branch', 'develop']);
  sh(dir, 'git', ['branch', 'rc/uat']);
  sh(dir, 'git', ['checkout', '-qb', 'feature/task-123-ajuste']);
  fs.writeFileSync(path.join(classes, 'X.cls'), 'public class X {}');
  sh(dir, 'git', ['add', '-A']);
  sh(dir, 'git', ['commit', '-qm', 'feat']);
  sh(dir, 'git', ['checkout', '-q', 'develop']);
  sh(dir, 'git', ['merge', '-q', '--no-ff', 'feature/task-123-ajuste', '-m', 'merge']);
  sh(dir, 'git', ['checkout', '-q', 'feature/task-123-ajuste']);
  return dir;
}

test('parseArgs reads command, flags and values', () => {
  const { command, flags } = parseArgs(['init', '--yes', '--envs', 'a,b', '--org=uat']);
  assert.equal(command, 'init');
  assert.deepEqual(flags, { yes: true, envs: 'a,b', org: 'uat' });
});

test('parseEnvs names environments and blocks deploy on the last one', () => {
  const envs = parseEnvs('develop/x,rc/uat/x,master');
  assert.deepEqual(envs.map((e) => e.name), ['develop', 'uat', 'producao']);
  assert.equal(envs[2].deploy, 'blocked');
  assert.equal(parseEnvs('dev:d,prod:main')[0].name, 'dev');
});

test('suggestEnvs finds develop, uat and master in that order', () => {
  assert.deepEqual(suggestEnvs(['master', 'feature/a', 'rc/uat/servico', 'develop/servico']), ['develop/servico', 'rc/uat/servico', 'master']);
});

test('init writes config, profile and gitignore; status shows where the feature is', () => {
  const dir = sampleProject();
  const init = reldor(dir, ['init', '--yes', '--no-cli', '--envs', 'develop,rc/uat,master']);
  assert.equal(init.status, 0, init.stderr);
  assert.ok(fs.existsSync(path.join(dir, '.reldor', 'reldor.config.yaml')));
  assert.match(fs.readFileSync(path.join(dir, '.reldor', 'profile.md'), 'utf8'), /fflib/);
  assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /\.reldor\/cache\//);

  sh(dir, 'git', ['add', '-A']);
  sh(dir, 'git', ['commit', '-qm', 'reldor']);

  const status = JSON.parse(reldor(dir, ['status', '--json', '--no-cli']).stdout);
  const states = Object.fromEntries(status.environments.items.map((i) => [i.name, i.state]));
  assert.equal(status.spec.current.name, 'task-123');
  assert.equal(states.uat, 'missing');
  assert.equal(states.producao, 'missing');
  assert.equal(status.next.id, 'promote');

  const again = reldor(dir, ['init', '--yes', '--no-cli']);
  assert.match(again.stdout, /já está configurado/);
});

test('status without config suggests init', () => {
  const dir = sampleProject();
  const status = JSON.parse(reldor(dir, ['status', '--json', '--no-cli']).stdout);
  assert.equal(status.config.exists, false);
  assert.equal(status.next.id, 'init');
});
