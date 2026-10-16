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
const CLS = 'force-app/main/default/classes';
const PS = 'force-app/main/default/permissionsets/Gestao_Contas.permissionset-meta.xml';

function git(cwd, args, extraEnv = {}) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...ENV, ...extraEnv } });
}

function reldor(cwd, args, env = {}) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...ENV, ...env } });
}

function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-git-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (src) => !src.includes(`${path.sep}.reldor`) });
  fs.writeFileSync(path.join(dir, '.gitignore'), '.reldor/work/\n.reldor/cache/\n.reldor/log/\n');
  git(dir, ['init', '-q', '-b', 'master']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'base']);
  return dir;
}

const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

test('clean commit: only your lines go in, what the retrieve brought stays out', () => {
  const dir = project();
  const scoreJob = read(dir, `${CLS}/ScoreJob.cls`);
  const retrieve = {
    [`${CLS}/ContaController.cls`]: read(dir, `${CLS}/ContaController.cls`).replace('LIMIT 10', 'LIMIT 50'),
    [`${CLS}/ScoreJob.cls`]: scoreJob.replace('public class ScoreJob', 'public with sharing class ScoreJob'),
    [`${CLS}/VeioDaOrg.cls`]: 'public class VeioDaOrg {}',
  };
  const r = reldor(dir, ['retrieve', '--yes', '--org', 'uat-sandbox'], { RELDOR_SF_BIN: FAKE_SF, RELDOR_FAKE_RETRIEVE: JSON.stringify(retrieve) });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /Foto tirada/);

  fs.writeFileSync(path.join(dir, `${CLS}/ScoreJob.cls`), read(dir, `${CLS}/ScoreJob.cls`).replace('insert propostas;', 'insert propostas; // minha mudança'));
  fs.writeFileSync(path.join(dir, `${CLS}/MinhaClasse.cls`), 'public class MinhaClasse {}');

  const plan = JSON.parse(reldor(dir, ['commit', '--dry-run', '--json']).stdout).plan;
  assert.deepEqual(plan.mine, [`${CLS}/MinhaClasse.cls`]);
  assert.deepEqual(plan.mixed, [`${CLS}/ScoreJob.cls`]);
  assert.deepEqual(plan.fromOrg.sort(), [`${CLS}/ContaController.cls`, `${CLS}/VeioDaOrg.cls`]);

  const c = reldor(dir, ['commit', '-m', 'minha feature', '--yes']);
  assert.equal(c.status, 0, c.stdout + c.stderr);
  const committed = git(dir, ['show', `HEAD:${CLS}/ScoreJob.cls`]).stdout;
  assert.match(committed, /minha mudança/, 'your line is in');
  assert.doesNotMatch(committed, /with sharing class ScoreJob/, 'the org line is out');
  const files = git(dir, ['show', '--name-only', '--format=', 'HEAD']).stdout.trim().split('\n').sort();
  assert.deepEqual(files, [`${CLS}/MinhaClasse.cls`, `${CLS}/ScoreJob.cls`]);

  const again = JSON.parse(reldor(dir, ['commit', '--dry-run', '--json']).stdout).plan;
  assert.deepEqual(again.mine, [], 'committed lines do not show up again');
});

test('pre-commit hook blocks duplicated XML and files that only came from the org', () => {
  const dir = project();
  const binDir = path.join(dir, '.bin');
  fs.mkdirSync(binDir);
  fs.writeFileSync(path.join(binDir, 'reldor'), `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`, { mode: 0o755 });
  const PATH = `${binDir}${path.delimiter}${process.env.PATH}`;
  assert.equal(reldor(dir, ['hook', 'install']).status, 0);

  const ps = read(dir, PS);
  const added = '<classAccesses><apexClass>RelatorioContas</apexClass><enabled>true</enabled></classAccesses>\n    <classAccesses><apexClass>ContaController</apexClass><enabled>true</enabled></classAccesses>\n    <label>';
  fs.writeFileSync(path.join(dir, PS), ps.replace('<label>', added));
  git(dir, ['add', PS]);
  const blocked = git(dir, ['commit', '-m', 'dup'], { PATH });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /duplicada/);

  assert.equal(reldor(dir, ['xml', PS]).status, 0);
  git(dir, ['add', PS]);
  assert.equal(git(dir, ['commit', '-m', 'ok'], { PATH }).status, 0, 'organized XML passes');

  const r = reldor(dir, ['retrieve', '--yes', '--org', 'uat-sandbox'], { RELDOR_SF_BIN: FAKE_SF, RELDOR_FAKE_RETRIEVE: JSON.stringify({ [`${CLS}/VeioDaOrg.cls`]: 'public class VeioDaOrg {}' }) });
  assert.equal(r.status, 0);
  git(dir, ['add', `${CLS}/VeioDaOrg.cls`]);
  const fromOrg = git(dir, ['commit', '-m', 'org'], { PATH });
  assert.notEqual(fromOrg.status, 0);
  assert.match(fromOrg.stderr, /veio da org/);
});

test('retrieve warns about uncommitted work before overwriting it', () => {
  const dir = project();
  fs.appendFileSync(path.join(dir, `${CLS}/ScoreJob.cls`), '\n// trabalho em andamento');
  const r = reldor(dir, ['retrieve', '--yes', '--org', 'uat-sandbox', '--metadata', 'ApexClass:ScoreJob'], { RELDOR_SF_BIN: FAKE_SF });
  assert.match(r.stdout, /não commitado/);
  assert.match(r.stdout, /conta como SEU/);
});
