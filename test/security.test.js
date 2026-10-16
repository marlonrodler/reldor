'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scanFile } = require('../modules/sf/security/rules');
const { securityReview } = require('../modules/sf/security');
const { buildIndex } = require('../modules/sf/indexer');

const rules = (file, text) => scanFile(file, text).map((f) => `${f.severity}:${f.rule}`);

test('SOQL injection only when a value from outside the method is concatenated', () => {
  const bad = `public with sharing class A {
    @AuraEnabled(cacheable=true)
    public static List<Account> buscar(String nome) {
      String q = 'SELECT Id FROM Account WHERE Name = \\'' + nome + '\\' WITH USER_MODE';
      return Database.query(q);
    } }`;
  assert.ok(rules('A.cls', bad).includes('alta:soql-injection'));
  const safe = `public with sharing class A {
    @AuraEnabled(cacheable=true)
    public static List<Account> buscar(String nome) {
      String clause = 'WHERE Name = :nome';
      return Database.query('SELECT Id FROM Account ' + clause + ' WITH USER_MODE');
    } }`;
  assert.deepEqual(rules('A.cls', safe), []);
});

test('CRUD/FLS on exposed methods, sharing, secrets, logs and weak crypto', () => {
  const src = `public class B {
    @AuraEnabled
    public static void salvar(Account a) { update a; }
    public static void x(Account conta) {
      System.debug('cpf ' + conta.CPF__c);
      HttpRequest r = new HttpRequest(); r.setEndpoint('http://api.exemplo.com');
      String h = Crypto.generateDigest('MD5', Blob.valueOf('a')).toString();
    } }`;
  const found = rules('B.cls', src);
  for (const r of ['alta:crud-fls', 'alta:sharing', 'média:dado-sensivel-no-log', 'alta:callout-sem-tls', 'média:cripto-fraca']) assert.ok(found.includes(r), r);
  assert.deepEqual(rules('B.cls', src.replace('update a;', 'update as user a;')).filter((r) => r.includes('crud')), []);
  assert.deepEqual(rules('B.cls', src.replace("System.debug('cpf ' + conta.CPF__c);", "// reldor-ignore: dado-sensivel-no-log\n      System.debug('cpf ' + conta.CPF__c);")).filter((r) => r.includes('log')), []);
});

test('LWC, Visualforce, flows and guest profiles', () => {
  assert.deepEqual(rules('lwc/c/c.js', 'this.template.querySelector("div").innerHTML = this.texto;'), ['alta:lwc-xss']);
  assert.deepEqual(rules('pages/p.page', '<apex:outputText value="{!x}" escape="false"/><script>var a = "{!conta.Name}"; var b = "{!$Resource.x}";</script>'), ['alta:vf-xss', 'média:vf-xss']);
  assert.deepEqual(rules('flows/F.flow-meta.xml', '<Flow><processType>Flow</processType><runInMode>SystemModeWithoutSharing</runInMode></Flow>'), ['alta:flow-sem-sharing']);
  assert.deepEqual(rules('profiles/G.profile-meta.xml', '<Profile><userLicense>Guest User License</userLicense><objectPermissions><allowEdit>true</allowEdit><object>Account</object></objectPermissions></Profile>'), ['alta:convidado-com-acesso']);
});

test('flow-level: an exposed method that reaches a "without sharing" class that reads data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-sec-'));
  fs.cpSync(path.join(__dirname, 'fixtures', 'sample-sf'), dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  const { model } = buildIndex(dir, { full: true });
  const r = securityReview(dir, ['force-app/main/default/classes/PainelController.cls'], { model, analyzer: false });
  const pathHit = r.findings.find((f) => f.rule === 'caminho-sem-sharing');
  assert.ok(pathHit, 'path finding');
  assert.deepEqual(pathHit.path, ['PainelController', 'AcessoTotal']);
});
