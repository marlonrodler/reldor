'use strict';

// Cases found by running Reldor over large public Salesforce projects (NPSP, EDA, PMM and others).
// Each test keeps one bug from coming back.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseApexClass } = require('../modules/sf/indexer/apex');
const { buildRadar, creatorMethods } = require('../modules/sf/test-radar');
const { relatedTests } = require('../modules/sf/indexer/query');
const { sweepFieldUsages } = require('../modules/sf/checks/usages-sweep');
const { scanFile } = require('../modules/sf/security/rules');
const { hookScript } = require('../core/cli/git-commands');

const rules = (file, text) => scanFile(file, text).map((f) => `${f.severity}:${f.rule}`);

/** A minimal model with the given classes (name -> source). */
function model(sources) {
  const classes = {};
  for (const [name, src] of Object.entries(sources)) classes[name] = parseApexClass(name, src);
  return { classes, triggers: {}, flows: {}, objects: { Account: { fields: {} }, Contact: { fields: {} } }, application: { services: {} }, permissions: [], customMetadata: {} };
}

test('index: a method named toString, valueOf or hasOwnProperty does not break the class', () => {
  const src = `public class Moeda {
    public override String toString() { return 'x'; }
    public Integer valueOf() { return 1; }
    public Boolean hasOwnProperty() { return toString() != null; }
  }`;
  const c = parseApexClass('Moeda', src);
  assert.equal(c.name, 'Moeda');
  assert.ok(c.methodCalls.hasOwnProperty.includes('toString'));
});

test('a @isTest data factory is not a test; a class with test methods is', () => {
  const factory = parseApexClass('DadosTeste', `@isTest public class DadosTeste {
    public static Account conta() { Account a = new Account(Name='x'); insert a; return a; } }`);
  const real = parseApexClass('ContaTest', `@isTest private class ContaTest {
    @isTest static void deveSalvar() { DadosTeste.conta(); } }`);
  assert.equal(factory.hasTestMethods, false);
  assert.equal(real.hasTestMethods, true);
  const m = { classes: { DadosTeste: factory, ContaTest: real } };
  assert.deepEqual(relatedTests(m, 'Account', []).byObject, []);
});

test('radar: factories are followed method by method, through chains', () => {
  const m = model({
    Fabrica: `@isTest public class Fabrica {
      public static Account conta() { Account a = new Account(Name='x'); insert a; return a; }
      public static Account contaCompleta() { return conta(); }
      public static Contact contato() { Contact c = new Contact(LastName='y'); insert c; return c; } }`,
    ContaTest: `@isTest private class ContaTest { @isTest static void a() { Fabrica.contaCompleta(); } }`,
    ContatoTest: `@isTest private class ContatoTest { @isTest static void b() { Fabrica.contato(); } }`,
    MemoriaTest: `@isTest private class MemoriaTest { @isTest static void c() { Account a = new Account(Name='z'); System.assert(a != null); } }`,
  });
  assert.deepEqual([...creatorMethods(m, 'Account')].sort(), ['ContaTest.a', 'Fabrica.conta', 'Fabrica.contaCompleta', 'MemoriaTest.c']);
  const radar = buildRadar(m, [{ file: 'x', status: 'modified', meta: { type: 'validationRule', object: 'Account', name: 'VR' } }]);
  const by = Object.fromEntries(radar.tests.map((t) => [t.name, t]));
  assert.equal(by.ContaTest.priority, 'alta');
  assert.match(by.ContaTest.reasons[0], /factory Fabrica\.contaCompleta/);
  assert.equal(by.MemoriaTest.priority, 'média');
  assert.equal(by.ContatoTest, undefined, 'a test that only creates Contact is not affected by an Account rule');
  assert.equal(by.Fabrica, undefined, 'the factory itself is not a test');
});

test('usages sweep: finds the field in reports, field sets, LWC/VF and Apex strings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-sweep-'));
  const base = path.join(root, 'force-app', 'main', 'default');
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true });
    fs.writeFileSync(path.join(base, rel), text);
  };
  put('reports/R/Rel.report-meta.xml', '<Report><columns><field>Account.Score__c</field></columns></Report>');
  put('objects/Account/fieldSets/Resumo.fieldSet-meta.xml', '<FieldSet><displayedFields><field>Score__c</field></displayedFields></FieldSet>');
  put('objects/Account/fields/Score__c.field-meta.xml', '<CustomField><fullName>Score__c</fullName></CustomField>');
  put('lwc/painel/painel.html', '<template>{conta.Score__c}</template>');
  put('lwc/painel/__tests__/painel.test.js', 'Score__c');
  put('classes/Dinamica.cls', "public class Dinamica { String q = 'SELECT Score__c FROM Account'; }");
  const hits = sweepFieldUsages(root, ['force-app'], 'Account', 'Score__c', new Set());
  const files = hits.map((h) => path.basename(h.file || h.path || h.name || '')).join(' ');
  const text = JSON.stringify(hits);
  assert.match(text, /"name":"Rel"/);
  assert.match(text, /Account\.Resumo/);
  assert.match(text, /"name":"painel"/);
  assert.match(text, /Dinamica/);
  assert.doesNotMatch(text, /__tests__/, 'jest tests are left out');
  assert.doesNotMatch(text, /Score__c\.field-meta/, 'the field file itself is not a usage');
  assert.ok(files.length > 0);
});

test('security: DTO with @AuraEnabled properties is not an entry point; test classes and placeholders are quiet', () => {
  const dto = `public class ProdutoVM {
    @AuraEnabled public String nome { get; set; }
    @AuraEnabled public Integer qtd;
    public ProdutoVM(String n) { nome = n; } }`;
  assert.ok(!rules('ProdutoVM.cls', dto).some((r) => r.endsWith('sharing')), rules('ProdutoVM.cls', dto).join());
  const ctrl = `public class Ctrl {
    @AuraEnabled(cacheable=true)
    public static List<Account> listar() { return [SELECT Id FROM Account WITH USER_MODE]; } }`;
  assert.ok(rules('Ctrl.cls', ctrl).some((r) => /sharing/.test(r)), 'a real @AuraEnabled method still needs sharing');
  const t = `@isTest private class XTest { @isTest static void a() { String q = 'SELECT Id FROM Account WHERE Name = \\'' + x + '\\''; Database.query(q); } }`;
  assert.deepEqual(rules('XTest.cls', t), []);
  const ph = `public with sharing class Msg { static final String PASSWORD_MSG = 'Senha: {0}'; }`;
  assert.ok(!rules('Msg.cls', ph).some((r) => /secret|segredo/.test(r)));
});

test('security: Visualforce escape="false" on labels and literals is not XSS; on user input it is', () => {
  const safe = '<apex:page><apex:outputText escape="false" value="{!$Label.Ajuda}"/><apex:outputText escape="false" value="{!IF(x, \'<b>a</b>\', \'\')}"/></apex:page>';
  assert.deepEqual(rules('P.page', safe).filter((r) => /xss/.test(r)), []);
  const bad = '<apex:page><apex:outputText escape="false" value="{!$CurrentPage.parameters.q}"/></apex:page>';
  assert.ok(rules('P.page', bad).some((r) => /xss/.test(r)));
});

test('pre-commit hook calls this Reldor by absolute path, with PATH as fallback', () => {
  const s = hookScript('/opt/node/bin/node', '/opt/reldor/core/cli/index.js');
  assert.match(s, /exec "\/opt\/node\/bin\/node" "\/opt\/reldor\/core\/cli\/index\.js" precommit/);
  assert.match(s, /reldor precommit/);
});

test('a "/*" or "//" inside an Apex string is not a comment', () => {
  const c = parseApexClass('Upload', `public class Upload {
    String tipo = 'image/*';
    String url = 'https://api.exemplo.com';
    public void enviar() { Einstein_Uso u = new Einstein_Uso(); }
    /* comentário com Fantasma */
  }`);
  assert.ok(c.identifiers.includes('Einstein_Uso'));
  assert.ok(!c.identifiers.includes('Fantasma'));
  assert.ok(c.strings.length >= 0);
});

test('a class whose name starts in lower case is still found by the tests that use it', () => {
  const t = parseApexClass('mc_EnviarTest', `@isTest public class mc_EnviarTest {
    @isTest static void a() { mc_Enviar.request r = new mc_Enviar.request(); mc_Enviar.executar(new List<mc_Enviar.request>{ r }); } }`);
  assert.ok(t.identifiers.includes('mc_Enviar'));
});

test('usages: a formula through a lookup counts for the parent field, not for a same-named field here', () => {
  const { findUsages } = require('../modules/sf/checks/usages');
  const f = (name, extra = {}) => ({ name, formulaRefs: [], ...extra });
  const m = {
    classes: {}, triggers: {}, flows: {}, lwc: {}, ui: [], permissions: [], customMetadata: {}, application: { services: {} },
    objects: {
      Servico__c: { name: 'Servico__c', validationRules: [], fields: { Unidade__c: f('Unidade__c') } },
      Entrega__c: {
        name: 'Entrega__c', validationRules: [],
        fields: {
          Servico__c: f('Servico__c', { referenceTo: 'Servico__c' }),
          Unidade__c: f('Unidade__c', { formulaRefs: ['Servico__r.Unidade__c'] }),
        },
      },
    },
  };
  const names = (q) => findUsages(m, q).map((h) => `${h.where}:${h.name}`);
  assert.ok(names('Servico__c.Unidade__c').includes('Fórmula:Entrega__c.Unidade__c'));
  assert.ok(!names('Entrega__c.Unidade__c').includes('Fórmula:Entrega__c.Unidade__c'));
});

test('radar: objects with a lower-case namespace (npe01__X__c) and any letter case are matched', () => {
  const m = model({
    Ajustes: `public class Ajustes {
      public static npe01__Config__c paraTestes(npe01__Config__c c) { upsert c; return c; } }`,
    ConfigTest: `@isTest private class ConfigTest {
      @isTest static void a() { Ajustes.paraTestes(new npe01__config__c(npe01__Ativo__c = true)); } }`,
  });
  m.objects.npe01__Config__c = { fields: {} };
  const radar = buildRadar(m, [{ file: 'x', status: 'modified', meta: { type: 'field', object: 'npe01__Config__c', name: 'npe01__Ativo__c' } }]);
  assert.deepEqual(radar.tests.map((t) => t.name), ['ConfigTest']);
});

test('quality: the code between two short strings is not a repeated text', () => {
  const { findRepetition } = require('../modules/sf/quality/repetition');
  const cls = (name) => `public class ${name} { void a(HttpResponse res) { System.debug('Erro: ' + res.getStatusCode() + ' em ' + res.getBody()); } }`;
  const sources = new Map(['A', 'B', 'C'].map((n) => [`${n}.cls`, { text: cls(n), className: n, isTest: false }]));
  const found = findRepetition(sources, new Map([['A.cls', null]]), { objects: {} }, {}).filter((f) => f.kind === 'texto-repetido');
  assert.deepEqual(found, []);
});
