'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'core', 'cli', 'index.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-sf');
const CLS = 'force-app/main/default/classes';
const PS = 'force-app/main/default/permissionsets/Gestao_Contas.permissionset-meta.xml';
const git = (cwd, args) => spawnSync('git', ['-c', 'user.name=dev', '-c', 'user.email=dev@x', ...args], { cwd, encoding: 'utf8' });

test('reldor review: one run, one summary, with what blocks the commit first', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-review-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  fs.writeFileSync(path.join(dir, '.gitignore'), '.reldor/\n');
  git(dir, ['init', '-q', '-b', 'master']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'base']);
  git(dir, ['checkout', '-qb', 'feature/x']);
  fs.writeFileSync(path.join(dir, CLS, 'Busca.cls'), `public with sharing class Busca {
  @AuraEnabled
  public static List<Account> porNome(String nome) {
    Account conta = new Account();
    System.debug('cpf ' + conta.CPF__c);
    return Database.query('SELECT Id FROM Account WHERE Name = \\'' + nome + '\\' WITH USER_MODE');
  }
}
`);
  const ps = fs.readFileSync(path.join(dir, PS), 'utf8');
  fs.writeFileSync(path.join(dir, PS), ps.replace('<label>', '<classAccesses><apexClass>Busca</apexClass><enabled>true</enabled></classAccesses>\n    <label>').replace('</classAccesses>', '</classAccesses>\n    <classAccesses><apexClass>ContaController</apexClass><enabled>false</enabled></classAccesses>'));

  const run = spawnSync(process.execPath, [CLI, 'review', '--no-analyzer', '--json'], { cwd: dir, encoding: 'utf8', env: { ...process.env, RELDOR_SF_BIN: '/nonexistent' } });
  const r = JSON.parse(run.stdout);
  assert.equal(r.files, 2);
  assert.ok(r.blocking.some((b) => b.area === 'segurança' && /injection|concaten/i.test(b.text)), JSON.stringify(r.blocking));
  assert.ok(r.blocking.some((b) => b.area === 'xml' && /ContaController/.test(b.text)), 'same class with two different values');
  assert.ok(r.attention.some((a) => a.area === 'segurança'), 'sensitive data in the log');
  const text = spawnSync(process.execPath, [CLI, 'review', '--no-analyzer'], { cwd: dir, encoding: 'utf8', env: { ...process.env, RELDOR_SF_BIN: '/nonexistent' } }).stdout;
  assert.ok(text.indexOf('Corrija antes do commit') < text.indexOf('Atenção'));
});
