'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'core', 'cli', 'index.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-sf');
const FAKE_SF = path.join(__dirname, 'fakes', 'sf.js');
const ENV = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };

function sh(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...ENV } });
  if (r.status !== 0) throw new Error(r.stderr);
}

/** The sample project as a git repo: master has everything, the feature branch changes the validation rule. */
function featureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-radar-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (src) => !src.includes(`${path.sep}.reldor`) });
  sh(dir, ['init', '-q', '-b', 'master']);
  sh(dir, ['add', '-A']);
  sh(dir, ['commit', '-qm', 'base']);
  sh(dir, ['checkout', '-qb', 'feature/cpf']);
  const vr = path.join(dir, 'force-app/main/default/objects/Account/validationRules/CPF_Obrigatorio.validationRule-meta.xml');
  fs.writeFileSync(vr, fs.readFileSync(vr, 'utf8').replace('Private', 'Varejo'));
  return dir;
}

function reldor(cwd, args, env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
}

test('radar: a validation rule change points to every test that creates the object', () => {
  const dir = featureRepo();
  const r = reldor(dir, ['test-radar', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out.objects, ['Account']);
  assert.ok(out.changes[0].file.startsWith('force-app/'), 'git status paths keep their first letter');
  const names = out.tests.map((t) => t.name);
  assert.ok(names.includes('AccountsTest'));
  assert.equal(out.tests.find((t) => t.name === 'AccountsTest').priority, 'alta');
  assert.match(out.tests[0].reasons[0], /validation rule CPF_Obrigatorio \(alterado\)/);
});

test('radar: a class change points to the tests that use it, and checks its queries', () => {
  const dir = featureRepo();
  const cls = path.join(dir, 'force-app/main/default/classes/RelatorioContas.cls');
  fs.appendFileSync(cls, '\n// ajuste');
  const out = JSON.parse(reldor(dir, ['test-radar', '--json', '--files', 'force-app/main/default/classes/RelatorioContas.cls']).stdout);
  assert.deepEqual(out.tests.map((t) => t.name), ['RelatorioContasTest']);
  assert.equal(out.queryIssues[0].field, 'Score__c');
});

test('radar --run validates local changes without saving, and reports failures and coverage', () => {
  const dir = featureRepo();
  const log = path.join(dir, 'sf-args.json');
  // Execution off (the default): the sf command is handed over and nothing runs in the org.
  const handed = JSON.parse(reldor(dir, ['test-radar', '--run', '--org', 'uat-sandbox', '--json'], { RELDOR_SF_BIN: FAKE_SF, RELDOR_SF_LOG: log }).stdout);
  assert.ok(!fs.existsSync(log), 'sf was not called');
  assert.match(handed.commands[0], /^sf project deploy start --dry-run --target-org uat-sandbox --wait 60 --test-level RunSpecifiedTests .*--tests \w+Test/);
  fs.mkdirSync(path.join(dir, '.reldor'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.reldor', 'reldor.config.yaml'), 'execute: on\n');
  const r = reldor(dir, ['test-radar', '--run', '--yes', '--org', 'uat-sandbox', '--json'], { RELDOR_SF_BIN: FAKE_SF, RELDOR_SF_LOG: log });
  const args = JSON.parse(fs.readFileSync(log, 'utf8'));
  assert.ok(args.includes('--dry-run'), 'never saves to the org');
  assert.ok(args.includes('RunSpecifiedTests'));
  assert.ok(args.includes('force-app/main/default/objects/Account/validationRules/CPF_Obrigatorio.validationRule-meta.xml'));
  const out = JSON.parse(r.stdout);
  assert.equal(out.run.failed[0].test, 'RelatorioContasTest.deveResumir');
  assert.equal(out.run.coverage[0].percent, 60);
  assert.equal(r.status, 2);
});

test('radar --run refuses production', () => {
  const dir = featureRepo();
  fs.mkdirSync(path.join(dir, '.reldor'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.reldor', 'reldor.config.yaml'), 'environments:\n  - name: producao\n    branch: master\n    org: prod-org\n    deploy: blocked\n');
  const r = reldor(dir, ['test-radar', '--run', '--yes', '--org', 'prod-org'], { RELDOR_SF_BIN: FAKE_SF });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /produção/);
});
