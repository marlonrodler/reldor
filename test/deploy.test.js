'use strict';

// Windows: keep \n as written (see review.test.js).
process.env.GIT_CONFIG_COUNT = '1';
process.env.GIT_CONFIG_KEY_0 = 'core.autocrlf';
process.env.GIT_CONFIG_VALUE_0 = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'core', 'cli', 'index.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-sf');
const CLS = 'force-app/main/default/classes/ContaController.cls';
const ENV = { ...process.env, RELDOR_SF_BIN: '/nonexistent', SF_TARGET_ORG: '' };
const git = (cwd, args) => spawnSync('git', ['-c', 'user.name=dev', '-c', 'user.email=dev@x', ...args], { cwd, encoding: 'utf8' });
const reldor = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: ENV });

// A project with one changed class on a feature branch.
function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-deploy-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  fs.writeFileSync(path.join(dir, '.gitignore'), '.reldor/\n');
  git(dir, ['init', '-q', '-b', 'master']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'base']);
  git(dir, ['checkout', '-qb', 'feature/x']);
  reldor(dir, ['init', '--yes', '--envs', 'uat:master', '--no-cli']);
  fs.appendFileSync(path.join(dir, CLS), '\n// mudou\n');
  git(dir, ['commit', '-qam', 'mudou']);
  return dir;
}

test('deploy: builds the validation and deploy commands, never runs them; production only validates', () => {
  const dir = project();
  const head = git(dir, ['rev-parse', 'HEAD']).stdout;
  const r = JSON.parse(reldor(dir, ['deploy', '--org', 'dev-sb', '--base', 'master', '--json']).stdout);
  assert.deepEqual(r.files, [CLS]);
  assert.equal(r.org, 'dev-sb');
  assert.match(r.commands[0], /^sf project deploy start --dry-run --target-org dev-sb --source-dir force-app\/main\/default\/classes\/ContaController\.cls --test-level /);
  assert.ok(r.commands.some((c) => c.startsWith('sf project deploy quick')), JSON.stringify(r.commands));
  assert.equal(git(dir, ['rev-parse', 'HEAD']).stdout, head, 'nothing committed');

  // No org anywhere: a placeholder and the hint, not an error.
  const text = reldor(dir, ['deploy', '--base', 'master']).stdout;
  assert.match(text, /<alias-da-org>/);

  // The production environment: only the validation.
  reldor(dir, ['env', '--org-for', 'uat:prod-org']);
  reldor(dir, ['env', '--production', 'uat']);
  const p = JSON.parse(reldor(dir, ['deploy', 'uat', '--base', 'master', '--json']).stdout);
  assert.equal(p.production, true);
  assert.equal(p.commands.length, 1);
  assert.match(p.commands[0], /--dry-run --target-org prod-org/);
});
