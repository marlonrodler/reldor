'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { merge3 } = require('../core/git/merge3');

const CLI = path.join(__dirname, '..', 'core', 'cli', 'index.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-sf');
const FAKE_SF = path.join(__dirname, 'fakes', 'sf.js');
const CLS = 'force-app/main/default/classes';
const C = `${CLS}/Calc.cls`;
const PS = 'force-app/main/default/permissionsets/Gestao_Contas.permissionset-meta.xml';

const git = (cwd, args, who = 'dev') => spawnSync('git', ['-c', `user.name=${who}`, '-c', `user.email=${who}@x`, ...args], { cwd, encoding: 'utf8' });
const reldor = (cwd, args, env = {}) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
const json = (cwd, args) => JSON.parse(reldor(cwd, [...args, '--json']).stdout);
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const write = (dir, f, t) => fs.writeFileSync(path.join(dir, f), t);
const edit = (dir, f, from, to) => write(dir, f, read(dir, f).replace(from, to));

const CALC = 'public with sharing class Calc {\n  public static Integer a() {\n    return 1;\n  }\n\n  public static Integer b() {\n    return 2;\n  }\n}\n';

test('merge3: changes next to each other both go in; the same line changed twice is the only conflict', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-m3-'));
  git(dir, ['init', '-q']);
  const target = CALC.replace('return 1;', 'return 10;').replace('    return 2;\n  }\n}', '    return 2;\n  }\n\n  public static Integer c() {\n    return 3;\n  }\n}');
  const ours = CALC.replace('  public static Integer b() {', '  // documentado\n  public static Integer b() {').replace('    return 2;\n  }\n}', '    return 2;\n  }\n\n  public static Integer d() {\n    return 4;\n  }\n}');
  const r = merge3(dir, CALC, target, ours);
  assert.deepEqual(r.conflicts, []);
  for (const piece of ['return 10;', '// documentado', 'Integer c()', 'Integer d()']) assert.ok(r.text.includes(piece), piece);
  assert.ok(r.text.indexOf('Integer c()') < r.text.indexOf('Integer d()'), 'target first, then ours');
  const hard = merge3(dir, CALC, target, CALC.replace('return 1;', 'return 99;'));
  assert.equal(hard.conflicts.length, 1);
  assert.deepEqual([hard.conflicts[0].target, hard.conflicts[0].ours], [['    return 10;'], ['    return 99;']]);
});

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-merge-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  fs.mkdirSync(path.join(dir, '.reldor'), { recursive: true });
  write(dir, '.reldor/reldor.config.yaml', 'environments:\n  - name: pre-uat\n    branch: develop\n  - name: production\n    branch: master\n');
  write(dir, '.gitignore', '.reldor/cache/\n.reldor/log/\n.reldor/work/\n');
  write(dir, C, CALC);
  write(dir, `${C}-meta.xml`, '<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>61.0</apiVersion><status>Active</status></ApexClass>');
  git(dir, ['init', '-q', '-b', 'master']);
  git(dir, ['config', 'user.name', 'dev']);
  git(dir, ['config', 'user.email', 'dev@x']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'base']);
  git(dir, ['branch', 'develop']);
  return dir;
}

test('reldor merge: resolves what Git stops on, checks "only yours", commits the merge on --continue', () => {
  const dir = repo();
  git(dir, ['checkout', '-qb', 'feature/outra']);
  edit(dir, C, 'return 1;', 'return 10;');
  edit(dir, PS, '</classAccesses>', '</classAccesses>\n    <classAccesses><apexClass>Outra</apexClass><enabled>true</enabled></classAccesses>');
  git(dir, ['commit', '-qam', 'outra'], 'ana');
  git(dir, ['checkout', '-q', 'develop']);
  git(dir, ['merge', '-q', '--no-ff', '--no-edit', 'feature/outra']);
  git(dir, ['checkout', '-qb', 'feature/minha', 'master']);
  edit(dir, C, '  }\n\n  public static Integer b()', '  } // fim de a\n\n  public static Integer b()');
  edit(dir, PS, '</classAccesses>', '</classAccesses>\n    <classAccesses><apexClass>Minha</apexClass><enabled>true</enabled></classAccesses>');
  git(dir, ['commit', '-qam', 'minha']);

  // Plain git stops on both files.
  git(dir, ['checkout', '-qb', 'merge/minha', 'develop']);
  assert.match(git(dir, ['merge', '--no-ff', '--no-commit', 'feature/minha']).stdout, /CONFLICT[\s\S]*CONFLICT/);
  git(dir, ['merge', '--abort']);

  assert.match(reldor(dir, ['merge', 'feature/outra', '--yes']).stderr + reldor(dir, ['merge', '--abort']).stdout, /./);
  const r = json(dir, ['merge', 'feature/minha', '--yes']);
  assert.deepEqual(r.hard, []);
  assert.deepEqual(r.resolved.map((x) => x.file).sort(), [C, PS]);
  assert.equal(r.verify.ok, true, JSON.stringify(r.verify.issues));
  assert.ok(read(dir, C).includes('return 10;') && read(dir, C).includes('// fim de a'));
  const done = json(dir, ['merge', '--continue', '--yes']);
  assert.equal(done.committed, true);
  assert.equal(git(dir, ['rev-list', '--parents', '-n', '1', 'HEAD']).stdout.trim().split(' ').length, 3, 'a real merge commit (--no-ff)');
  assert.equal(json(dir, ['merge', '--check']).ok, true);
});

test('reldor merge: a real conflict is left for review, and a wrong resolution is caught', () => {
  const dir = repo();
  git(dir, ['checkout', '-qb', 'feature/outra']);
  edit(dir, C, 'return 1;', 'return 10;');
  edit(dir, C, '    return 2;\n  }\n}', '    return 2;\n  }\n\n  public static Integer c() {\n    return 3;\n  }\n}');
  git(dir, ['commit', '-qam', 'outra'], 'ana');
  git(dir, ['checkout', '-q', 'develop']);
  git(dir, ['merge', '-q', '--no-ff', '--no-edit', 'feature/outra']);
  git(dir, ['checkout', '-qb', 'feature/minha', 'master']);
  edit(dir, C, 'return 1;', 'return 99;');
  git(dir, ['commit', '-qam', 'minha']);
  git(dir, ['checkout', '-qb', 'merge/minha', 'develop']);

  const r = json(dir, ['merge', 'feature/minha', '--yes']);
  assert.equal(r.hard.length, 1);
  assert.deepEqual(r.hard[0].conflicts[0].ours, ['    return 99;']);
  assert.ok(r.verify.issues.some((i) => i.kind === 'conflito'));
  assert.equal(reldor(dir, ['merge', '--continue', '--yes']).status, 1, 'does not commit with markers');

  // Wrong: taking the whole file from my branch drops the colleague's method.
  write(dir, C, git(dir, ['show', `feature/minha:${C}`]).stdout);
  const v = json(dir, ['merge', '--check']);
  assert.ok(v.issues.some((i) => i.kind === 'removido-sem-ser-seu' && i.lines.includes('public static Integer c() {')), JSON.stringify(v.issues));

  // Right: keep the target, apply my change.
  write(dir, C, git(dir, ['show', `develop:${C}`]).stdout.replace('return 10;', 'return 99;'));
  const ok = json(dir, ['merge', '--check']);
  assert.deepEqual(ok.issues.map((i) => i.kind), ['removido-sem-ser-seu'], 'only the decided line (10 -> 99) is pointed out');
  assert.deepEqual(ok.issues[0].lines, ['return 10;']);
});

test('reldor clean: leaves only your work in the folder, the org part goes to a stash and can come back', () => {
  const dir = repo();
  git(dir, ['checkout', '-qb', 'feature/minha']);
  const retrieve = {
    [`${CLS}/ScoreJob.cls`]: read(dir, `${CLS}/ScoreJob.cls`).replace('public class ScoreJob', 'public with sharing class ScoreJob'),
    [`${CLS}/VeioDaOrg.cls`]: 'public class VeioDaOrg {}',
  };
  const rt = reldor(dir, ['retrieve', '--yes', '--org', 'dev'], { RELDOR_SF_BIN: FAKE_SF, RELDOR_FAKE_RETRIEVE: JSON.stringify(retrieve) });
  assert.equal(rt.status, 0, rt.stdout + rt.stderr);
  edit(dir, `${CLS}/ScoreJob.cls`, 'insert propostas;', 'insert propostas; // minha');
  write(dir, `${CLS}/Minha.cls`, 'public class Minha {}');

  const c = reldor(dir, ['clean', '--yes']);
  assert.equal(c.status, 0, c.stdout + c.stderr);
  assert.ok(!fs.existsSync(path.join(dir, `${CLS}/VeioDaOrg.cls`)), 'org-only file left the folder');
  assert.ok(fs.existsSync(path.join(dir, `${CLS}/Minha.cls`)), 'my new file stays');
  const score = read(dir, `${CLS}/ScoreJob.cls`);
  assert.match(score, /minha/);
  assert.doesNotMatch(score, /with sharing class ScoreJob/, 'the org line left the file');

  // Any tool doing "git add -A" now commits only my work.
  git(dir, ['add', '-A']);
  assert.deepEqual(git(dir, ['diff', '--cached', '--name-only']).stdout.trim().split('\n').sort(), [`${CLS}/Minha.cls`, `${CLS}/ScoreJob.cls`]);
  git(dir, ['reset', '-q']);

  assert.equal(reldor(dir, ['clean', '--undo']).status, 0);
  assert.ok(fs.existsSync(path.join(dir, `${CLS}/VeioDaOrg.cls`)), 'the org part came back');
});

test('reldor merge: profile blocks that plain Git glues together come out whole (keep theirs, add mine)', () => {
  const dir = repo();
  const P = 'force-app/main/default/profiles/Admin.profile-meta.xml';
  const fp = (f, e) => `    <fieldPermissions>\n        <editable>${e}</editable>\n        <field>${f}</field>\n        <readable>true</readable>\n    </fieldPermissions>\n`;
  const profile = (...blocks) => `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="http://soap.sforce.com/2006/04/metadata">\n    <custom>false</custom>\n${blocks.join('')}</Profile>\n`;
  fs.mkdirSync(path.join(dir, 'force-app/main/default/profiles'), { recursive: true });
  write(dir, P, profile(fp('Account.A__c', true), fp('Account.D__c', true)));
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'profile']);
  git(dir, ['branch', '-f', 'develop']);
  git(dir, ['checkout', '-qb', 'feature/outra']);
  write(dir, P, profile(fp('Account.A__c', true), fp('Account.B__c', true), fp('Account.D__c', true)));
  git(dir, ['commit', '-qam', 'outra'], 'ana');
  git(dir, ['checkout', '-q', 'develop']);
  git(dir, ['merge', '-q', '--no-ff', '--no-edit', 'feature/outra']);
  git(dir, ['checkout', '-qb', 'feature/minha', 'master']);
  git(dir, ['merge', '-q', '--ff-only', 'develop~1']);
  write(dir, P, profile(fp('Account.A__c', true), fp('Account.C__c', false), fp('Account.D__c', false)));
  git(dir, ['commit', '-qam', 'minha']);
  git(dir, ['checkout', '-qb', 'merge/minha', 'develop']);

  // Plain Git mixes the tags of B (theirs) and C (mine).
  git(dir, ['merge', '--no-ff', '--no-commit', 'feature/minha']);
  assert.match(read(dir, P), /<<<<<<<[\s\S]*Account\.B__c[\s\S]*=======[\s\S]*Account\.C__c/);
  git(dir, ['merge', '--abort']);

  const r = json(dir, ['merge', 'feature/minha', '--yes']);
  assert.deepEqual(r.hard, []);
  assert.equal(r.verify.ok, true, JSON.stringify(r.verify.issues));
  const text = read(dir, P);
  assert.equal(text, profile(fp('Account.A__c', true), fp('Account.B__c', true), fp('Account.C__c', false), fp('Account.D__c', false)));
});

test('reldor merge: says loudly when something that is not yours is coming in', () => {
  const dir = repo();
  git(dir, ['checkout', '-qb', 'feature/outra']);
  edit(dir, C, 'return 2;', 'return 20;');
  git(dir, ['commit', '-qam', 'outra, ainda não está no ambiente'], 'ana');
  git(dir, ['checkout', '-qb', 'feature/minha', 'master']);
  git(dir, ['merge', '-q', '--no-edit', 'feature/outra']); // pulled a colleague's branch by mistake
  edit(dir, C, 'return 1;', 'return 11;');
  git(dir, ['commit', '-qam', 'minha']);
  git(dir, ['checkout', '-qb', 'merge/minha', 'develop']);
  const out = reldor(dir, ['merge', 'feature/minha', '--yes']).stdout;
  assert.match(out, /Está vindo coisa a mais que não é sua/);
  assert.match(out, /outra, ainda não está no ambiente \(ana\)/);
});
