'use strict';

process.env.GIT_CONFIG_COUNT = '1';
process.env.GIT_CONFIG_KEY_0 = 'core.autocrlf';
process.env.GIT_CONFIG_VALUE_0 = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { taskIdFrom, learnBranchShapes } = require('../core/task');
const { shapeToPattern } = require('../core/cli/task');

const CLI = path.join(__dirname, '..', 'core', 'cli', 'index.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-sf');
const ENV = { ...process.env, RELDOR_SF_BIN: '/nonexistent', SF_TARGET_ORG: '' };
const git = (cwd, args) => spawnSync('git', ['-c', 'user.name=dev', '-c', 'user.email=dev@x', ...args], { cwd, encoding: 'utf8' });
const reldor = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: ENV, input: '' });
const json = (cwd, args) => JSON.parse(reldor(cwd, [...args, '--json']).stdout);
const put = (dir, f, t = 'x\n') => {
  fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
  fs.writeFileSync(path.join(dir, f), t);
};

test('task id from many branch shapes, never a date or a version', () => {
  const cases = {
    'feature/1234': '1234',
    'feature/vendas-1234-ajuste-tela': '1234',
    'bugfix/ABC-123-descricao': 'ABC-123',
    '1234-ajuste': '1234',
    'feature/US-98765_tela': 'US-98765',
    'feature/ajuste-tela': null,
    'release/2024-10': null,
    'hotfix/1.250.3': null,
  };
  for (const [b, id] of Object.entries(cases)) assert.equal(taskIdFrom(b), id, b);
  assert.deepEqual(learnBranchShapes(['feature/a-2222-x', 'feature/b-3333-y', 'feature/4444', 'main']).map((s) => s.shape), ['feature/<time>-<id>-<descrição>', 'feature/<id>']);
  // The project's own shape, confirmed once, wins.
  const pattern = shapeToPattern('task/<id>');
  assert.equal(taskIdFrom('task/77', pattern), '77');
});

test('reldor task: finds the spec of the task in any tool, the docs folder, and notices a switch', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-task-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  put(dir, '.gitignore', '.reldor/\n');
  put(dir, '.kiro/specs/1234-ajuste/requirements.md');
  put(dir, 'specs/1234-outra-ferramenta/spec.md');
  put(dir, 'documentacao/times/vendas/a.md');
  put(dir, 'documentacao/times/compras/b.md');
  git(dir, ['init', '-q', '-b', 'master']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'base']);
  git(dir, ['checkout', '-qb', 'feature/vendas-1234-ajuste']);
  reldor(dir, ['init', '--no-cli']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'reldor']);

  const r = json(dir, ['task']);
  assert.equal(r.task.id, '1234');
  assert.deepEqual(r.task.specs.map((s) => s.tool).sort(), ['Kiro', 'Spec Kit'], 'two tools have a spec of this task');
  assert.equal(r.task.phase, 'desenvolver');
  assert.ok(r.docFolders.some((d) => d.path === 'documentacao/times' && d.folders.includes('vendas')), JSON.stringify(r.docFolders));
  assert.equal(r.branchShapes[0].shape, 'feature/<time>-<id>-<descrição>');

  // Choices are saved: the shape and the docs folder for the project, the output for the person.
  reldor(dir, ['task', 'set', '--branch-shape', 'feature/<time>-<id>-<descrição>', '--docs-dir', 'documentacao/times/{time}']);
  reldor(dir, ['task', 'output', 'ambos']);
  const after = json(dir, ['task']);
  assert.equal(after.docsDir, 'documentacao/times/{time}');
  assert.equal(after.task.output, 'ambos');
  assert.match(fs.readFileSync(path.join(dir, '.reldor', 'reldor.config.yaml'), 'utf8'), /branch_pattern/);

  // Another task on another branch: the switch is said once.
  git(dir, ['checkout', '-qb', 'feature/vendas-5678-outra']);
  const s = json(dir, ['status', '--quick']);
  assert.deepEqual(s.task.switched, { from: '1234', to: '5678' });
  assert.equal(s.task.spec, null);
  assert.equal(s.next.id, 'refine');
  assert.equal(json(dir, ['status', '--quick']).task.switched, null);

  // Named in the chat: holds on this branch.
  reldor(dir, ['task', 'use', 'XYZ-9']);
  assert.equal(json(dir, ['task']).task.id, 'XYZ-9');
  reldor(dir, ['task', 'clear']);
  assert.equal(json(dir, ['task']).task.id, '5678');
});
