'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'core', 'cli', 'index.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-sf');
const ENV = { ...process.env, RELDOR_SF_BIN: '/nonexistent', SF_TARGET_ORG: '' };
const reldor = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: ENV, input: '' });
const CLASSES = 'force-app/main/default/classes';

// The sample project plus two invented teams (VND and CMP) that each wrote the same helper, and one shared helper.
function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-teams-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  const cls = (name, body) => {
    fs.writeFileSync(path.join(dir, CLASSES, `${name}.cls`), body);
    fs.writeFileSync(path.join(dir, CLASSES, `${name}.cls-meta.xml`), '<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>61.0</apiVersion><status>Active</status></ApexClass>');
  };
  cls('VND_PedidoService', 'public with sharing class VND_PedidoService {\n  public static String formatarDocumento(String valor) { return valor; }\n}\n');
  cls('VND_PedidoSelector', 'public inherited sharing class VND_PedidoSelector {\n  public List<Account> buscar(Set<Id> ids) { return [SELECT Id FROM Account WHERE Id IN :ids]; }\n}\n');
  cls('VND_PedidoBuilder', 'public class VND_PedidoBuilder {\n  public VND_PedidoBuilder comValor(Decimal v) { return this; }\n  public VND_PedidoBuilder comConta(Id c) { return this; }\n}\n');
  cls('CMP_CompraService', 'public with sharing class CMP_CompraService {\n  public static String formatarDocumento(String valor, Boolean mascara) { return valor; }\n}\n');
  cls('CMP_CompraHandler', 'public class CMP_CompraHandler {\n  public void rodar() {}\n}\n');
  cls('CMP_CompraException', 'public class CMP_CompraException extends Exception {}\n');
  cls('StringUtils', 'public with sharing class StringUtils {\n  public static String somenteDigitos(String valor) { return valor; }\n  public static String formatarCpf(String cpf) { return cpf; }\n}\n');
  return dir;
}

test('profile: design patterns and teams by prefix, from the index', () => {
  const dir = project();
  assert.equal(reldor(dir, ['init', '--no-cli']).status, 0);
  const text = fs.readFileSync(path.join(dir, '.reldor', 'profile.md'), 'utf8');
  assert.match(text, /## Padrões de projeto/);
  assert.match(text, /Builder: 1 \(ex\.: VND_PedidoBuilder\)/);
  assert.match(text, /exceções próprias: 1/);
  assert.match(text, /- VND_: 3 classes/);
  assert.match(text, /- CMP_: 3 classes/);
  assert.match(text, /helpers: StringUtils/);
  assert.match(text, /método\(s\) com o mesmo nome em times diferentes/);
});

test('me: the team stays local; helpers: shared first, and the same method across teams', () => {
  const dir = project();
  reldor(dir, ['init', '--no-cli']);
  const none = JSON.parse(reldor(dir, ['me', '--json']).stdout);
  assert.equal(none.team, null);
  assert.ok(none.prefixes.some((p) => p.prefix === 'VND'));

  const me = JSON.parse(reldor(dir, ['me', '--team', 'vendas', '--prefix', 'VND_', '--json']).stdout);
  assert.equal(me.prefix, 'VND');
  assert.ok(me.found.classes.includes('VND_PedidoService'));
  assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /\.reldor\/local\.yaml/);
  assert.equal(JSON.parse(reldor(dir, ['status', '--json', '--quick']).stdout).me.team, 'vendas');
  assert.doesNotMatch(fs.readFileSync(path.join(dir, '.reldor', 'profile.md'), 'utf8'), /vendas/, 'the team is not in the shared profile');

  const h = JSON.parse(reldor(dir, ['helpers', 'formatar', '--json']).stdout);
  assert.equal(h.results[0].className, 'StringUtils', 'shared code first');
  assert.ok(h.results.some((r) => r.className === 'CMP_CompraService' && r.owner === 'CMP'));

  const s = JSON.parse(reldor(dir, ['helpers', '--similar', '--json']).stdout);
  const g = s.similar.find((x) => /formatarDocumento/.test(x.method));
  assert.ok(g, JSON.stringify(s.similar));
  assert.deepEqual(g.owners.sort(), ['CMP', 'VND']);
});
