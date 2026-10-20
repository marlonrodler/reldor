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
const PS = 'force-app/main/default/permissionsets/Gestao_Contas.permissionset-meta.xml';
const ENV = { ...process.env, RELDOR_SF_BIN: '/nonexistent' };
const git = (cwd, args) => spawnSync('git', ['-c', 'user.name=dev', '-c', 'user.email=dev@x', ...args], { cwd, encoding: 'utf8' });
const reldor = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: ENV });

// A project whose team already has a hook that removes duplicates from profiles and a pipeline with the Code Analyzer.
function teamProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-tools-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  fs.writeFileSync(path.join(dir, '.gitignore'), '.reldor/cache/\n.reldor/log/\n.reldor/work/\n');
  fs.mkdirSync(path.join(dir, '.husky'));
  fs.writeFileSync(path.join(dir, '.husky', 'pre-commit'), '#!/bin/sh\n# remove duplicated entries from profiles and permission sets\nnpm run team:xml\n');
  fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.github', 'workflows', 'ci.yml'), 'jobs:\n  scan:\n    steps:\n      - run: sf code-analyzer run --workspace .\n');
  git(dir, ['init', '-q', '-b', 'master']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'base']);
  git(dir, ['checkout', '-qb', 'feature/x']);
  reldor(dir, ['init', '--yes', '--envs', 'develop,master', '--design-system', 'slds', '--git-actions', 'off', '--no-cli']);
  return dir;
}

// A permission set with the same class twice (identical): a duplicate, not a conflict.
function addDuplicate(dir) {
  const file = path.join(dir, PS);
  const xml = fs.readFileSync(file, 'utf8');
  const entry = '<classAccesses><apexClass>ContaController</apexClass><enabled>true</enabled></classAccesses>';
  fs.writeFileSync(file, xml.replace('<label>', `${entry}\n    ${entry}\n    <label>`));
}

test('tools: finds the team\'s tools, suggests, and nothing is decided without the person', () => {
  const dir = teamProject();
  const r = JSON.parse(reldor(dir, ['tools', '--json']).stdout);
  const caps = r.suggestions.map((s) => s.capability);
  assert.ok(caps.includes('xml-duplicates'), JSON.stringify(r.suggestions));
  assert.ok(caps.includes('code-analyzer'));
  assert.equal(r.suggestions.find((s) => s.capability === 'xml-duplicates').suggested, 'verify');
  assert.match(r.suggestions.find((s) => s.capability === 'xml-duplicates').evidence[0], /\.husky\/pre-commit:2/);
  // Nothing was written by the detection.
  assert.ok(!/tools:/.test(fs.readFileSync(path.join(dir, '.reldor', 'reldor.config.yaml'), 'utf8')));
  // status tells the next step.
  const st = JSON.parse(reldor(dir, ['status', '--json', '--quick']).stdout);
  assert.equal(st.next.id, 'tools');
  // An invalid mode is refused.
  assert.equal(reldor(dir, ['tools', 'set', 'code-analyzer', 'verify']).status, 1);
  // Deciding, even "run", makes the suggestion go away.
  assert.equal(reldor(dir, ['tools', 'set', 'xml-duplicates', 'verify', '--owner', 'gancho do time']).status, 0);
  assert.equal(reldor(dir, ['tools', 'set', 'code-analyzer', 'run']).status, 0);
  const after = JSON.parse(reldor(dir, ['tools', '--json']).stdout);
  assert.deepEqual(after.suggestions.map((s) => s.capability), []);
  assert.equal(after.capabilities.find((c) => c.id === 'xml-duplicates').mode, 'verify');
});

test('tools: verify = the Reldor checks but never redoes the work, and points to the owner', () => {
  const dir = teamProject();
  reldor(dir, ['tools', 'set', 'xml-duplicates', 'verify', '--owner', 'gancho do time']);
  reldor(dir, ['tools', 'set', 'xml-order', 'verify', '--owner', 'gancho do time']);
  addDuplicate(dir);
  const before = fs.readFileSync(path.join(dir, PS), 'utf8');

  // reldor xml does not rewrite the file another tool owns.
  const x = reldor(dir, ['xml']);
  assert.equal(fs.readFileSync(path.join(dir, PS), 'utf8'), before, 'file must stay as it was');
  assert.match(x.stdout, /gancho do time/);
  assert.match(x.stdout, /Não mudei nada/);

  // The review checks it and says which tool to run.
  const r = JSON.parse(reldor(dir, ['review', '--no-analyzer', '--json']).stdout);
  const item = r.attention.find((a) => a.area === 'xml');
  assert.ok(item, JSON.stringify(r.attention));
  assert.match(item.fix, /gancho do time/);
  assert.ok(r.tools.some((t) => t.id === 'xml-duplicates' && t.mode === 'verify'));

  // The pre-commit guard still guarantees it: it blocks, pointing to the owner.
  git(dir, ['add', PS]);
  const pc = reldor(dir, ['precommit']);
  assert.equal(pc.status, 1);
  assert.match(pc.stderr, /gancho do time/);

  // --force: the person asked the Reldor to do it anyway.
  reldor(dir, ['xml', '--force']);
  assert.notEqual(fs.readFileSync(path.join(dir, PS), 'utf8'), before);
});

test('tools: skip = left out and listed; actions owned by others need --force', () => {
  const dir = teamProject();
  reldor(dir, ['tools', 'set', 'xml-duplicates', 'skip', '--owner', 'plugin do time']);
  reldor(dir, ['tools', 'set', 'pre-commit', 'skip', '--owner', 'husky do time']);
  reldor(dir, ['tools', 'set', 'run-tests', 'skip', '--owner', 'esteira']);
  addDuplicate(dir);
  const r = JSON.parse(reldor(dir, ['review', '--no-analyzer', '--json']).stdout);
  assert.ok(!r.attention.some((a) => a.area === 'xml' && /duplicad/.test(a.text)), 'duplicates are not checked');
  assert.ok(r.tools.some((t) => t.id === 'xml-duplicates' && t.mode === 'skip' && t.owner === 'plugin do time'), 'and it says so');
  git(dir, ['add', PS]);
  assert.equal(reldor(dir, ['precommit']).status, 0);
  const h = reldor(dir, ['hook', 'install']);
  assert.match(h.stdout, /husky do time/);
  assert.ok(!fs.existsSync(path.join(dir, '.git', 'hooks', 'pre-commit')) || !fs.readFileSync(path.join(dir, '.git', 'hooks', 'pre-commit'), 'utf8').includes('reldor-guard'));
  const text = reldor(dir, ['review', '--no-analyzer']).stdout;
  assert.match(text, /Fora desta revisão.*xml-duplicates \(plugin do time\)/);
});

test('run ledger: the same check over the same content runs once; a change runs it again', () => {
  const dir = teamProject();
  addDuplicate(dir);
  const first = JSON.parse(reldor(dir, ['review', '--no-analyzer', '--json']).stdout);
  assert.deepEqual(first.reused, []);
  const second = JSON.parse(reldor(dir, ['review', '--no-analyzer', '--json']).stdout);
  assert.ok(second.reused.includes('security') && second.reused.includes('xml-check'), JSON.stringify(second.reused));
  assert.deepEqual(second.blocking, first.blocking);
  // The separate command reuses the review's result for the same files and content.
  assert.match(reldor(dir, ['security']).stdout, /reaproveitado/);
  // --fresh runs again.
  assert.deepEqual(JSON.parse(reldor(dir, ['review', '--no-analyzer', '--json', '--fresh']).stdout).reused, []);
  // Changing a file changes the key: nothing stale is reused.
  fs.appendFileSync(path.join(dir, 'force-app/main/default/classes/ContaController.cls'), '\n// mudou\n');
  const third = JSON.parse(reldor(dir, ['review', '--no-analyzer', '--json']).stdout);
  assert.ok(!third.reused.includes('security'), JSON.stringify(third.reused));
});
