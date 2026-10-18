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
const { spawnSync } = require('node:child_process');
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
  assert.deepEqual([...creatorMethods(m, 'Account')].sort(), ['ContaTest.a', 'Fabrica.conta', 'Fabrica.contaCompleta']);
  assert.ok(creatorMethods(m, 'Account', 'builds').has('MemoriaTest.c'), 'built in memory, not saved');
  const radar = buildRadar(m, [{ file: 'x', status: 'modified', meta: { type: 'validationRule', object: 'Account', name: 'VR' } }]);
  const by = Object.fromEntries(radar.tests.map((t) => [t.name, t]));
  assert.equal(by.ContaTest.priority, 'alta');
  assert.match(by.ContaTest.reasons[0], /factory Fabrica\.contaCompleta/);
  assert.equal(by.MemoriaTest.priority, 'média');
  assert.equal(by.ContatoTest, undefined, 'a test that only creates Contact is not affected by an Account rule');
  assert.equal(by.Fabrica, undefined, 'the factory itself is not a test');
});

test('usages: each use of a field goes to its own object; same-named fields of other objects are set apart', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-usages-'));
  const base = path.join(root, 'force-app', 'main', 'default');
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true });
    fs.writeFileSync(path.join(base, rel), text);
  };
  fs.writeFileSync(path.join(root, 'sfdx-project.json'), JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }] }));
  const field = (obj, name, extra = '') => put(`objects/${obj}/fields/${name}.field-meta.xml`, `<CustomField><fullName>${name}</fullName>${extra}</CustomField>`);
  field('Account', 'Score__c');
  field('Lead', 'Score__c');
  field('Contact', 'Conta__c', '<referenceTo>Account</referenceTo><relationshipName>Conta</relationshipName><type>Lookup</type>');
  put('objects/Account/fieldSets/Resumo.fieldSet-meta.xml', '<FieldSet><displayedFields><field>Score__c</field></displayedFields></FieldSet>');
  put('reports/R/Rel.report-meta.xml', '<Report><columns><field>Account.Score__c</field></columns><columns><field>Lead.Score__c</field></columns></Report>');
  put('permissionsets/Vendas.permissionset-meta.xml', '<PermissionSet><fieldPermissions><field>Lead.Score__c</field></fieldPermissions></PermissionSet>');
  put('classes/Contas.cls', `public with sharing class Contas {
    public static void a(List<Account> contas, Map<Id, Account> porId) {
      for (Account c : contas) { c.Score__c = 1; }
      Decimal x = porId.get(null).Score__c;
      List<Contact> cs = [SELECT Id, Conta__r.Score__c FROM Contact];
    } }`);
  put('classes/Leads.cls', `public with sharing class Leads {
    public static void b(Lead l) { l.Score__c = 2; insert new Lead(Score__c = 3); }
    public static void c(SObject s) { Object v = s.get('Score__c'); }
    public static List<Lead> d() { return Database.query('SELECT Score__c FROM Lead'); } }`);
  put('classes/Dinamica.cls', `public with sharing class Dinamica {
    public static void e() { String q = 'SELECT Id, Score__c '; q += ' FROM Account'; Database.query(q); } }`);
  put('lwc/painel/painel.js', "import SCORE from '@salesforce/schema/Account.Score__c';\nexport default class Painel { get v() { return this.rec.Score__c; } }");
  put('lwc/painel/painel.html', '<template><lightning-record-form object-api-name="Lead"><lightning-input-field field-name="Score__c"></lightning-input-field></lightning-record-form></template>');
  put('lwc/painel/__tests__/painel.test.js', 'Score__c');
  const run = (q) => JSON.parse(spawnSync(process.execPath, [path.join(__dirname, '..', 'core', 'cli', 'index.js'), 'usages', q, '--json'], { cwd: root, encoding: 'utf8' }).stdout);
  const acc = run('Account.Score__c');
  const names = (list, cert) => list.filter((h) => !cert || h.certainty === cert).map((h) => `${h.where}:${h.name}`).sort();
  assert.deepEqual(names(acc.hits, 'certo'), ['Apex:Contas', 'Apex:Dinamica', 'Field set:Account.Resumo', 'LWC:painel', 'Report:Rel']);
  assert.deepEqual(names(acc.hits, 'possível'), ['Apex:Leads'], 'SObject.get: cannot tell the object, and it says so');
  assert.ok(acc.elsewhere.some((e) => e.name === 'Vendas' && e.object === 'Lead'));
  assert.ok(acc.elsewhere.some((e) => e.name === 'Leads' && e.object === 'Lead'));
  assert.ok(!JSON.stringify(acc).includes('__tests__'), 'jest tests are left out');
  const lead = run('Lead.Score__c');
  assert.deepEqual(names(lead.hits, 'certo'), ['Apex:Leads', 'LWC:painel', 'Permission set:Vendas', 'Report:Rel']);
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

test('radar: a test that saves another object counts when that object\'s trigger saves the changed one', () => {
  const m = model({
    ContatoHandler: `public class ContatoHandler { public static void depois(List<Contact> cs) { List<Account> casas = new List<Account>(); insert casas; } }`,
    ContatoTest: `@isTest private class ContatoTest { @isTest static void a() { Contact c = new Contact(LastName = 'x'); insert c; } }`,
    SoMemoriaTest: `@isTest private class SoMemoriaTest { @isTest static void b() { Account a = new Account(Name = 'y'); System.assert(a != null); } }`,
    ApagaTest: `@isTest private class ApagaTest { @isTest static void c(Account a) { delete a; } }`,
  });
  m.triggers.ContatoTrigger = { name: 'ContatoTrigger', object: 'Contact', events: ['after insert'], identifiers: ['ContatoHandler'], classRefs: [], fieldUses: [] };
  const radar = buildRadar(m, [{ file: 'x', status: 'modified', meta: { type: 'validationRule', object: 'Account', name: 'VR' } }]);
  const by = Object.fromEntries(radar.tests.map((t) => [t.name, t]));
  assert.equal(by.ContatoTest.priority, 'média', 'the other object’s automation may save it only on some paths');
  assert.match(by.ContatoTest.reasons[0], /salva Contact, e a trigger ContatoTrigger de Contact grava Account/);
  assert.equal(by.SoMemoriaTest.priority, 'média');
  assert.equal(by.ApagaTest, undefined, 'a delete does not run validation rules');
});

test('radar: a field change brings the tests that use the field; a record type change, the tests that use its name', () => {
  const m = model({
    UsaCampoTest: `@isTest private class UsaCampoTest { @isTest static void a(Account acc) { System.assertEquals(1, acc.Nota__c); } }`,
    OutroTest: `@isTest private class OutroTest { @isTest static void b(Lead l) { System.assertEquals(1, l.Nota__c); } }`,
    TipoTest: `@isTest private class TipoTest { @isTest static void c() { Id rt = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get('Varejo').getRecordTypeId(); } }`,
  });
  m.objects.Account.fields.Nota__c = { name: 'Nota__c' };
  m.objects.Lead = { fields: { Nota__c: { name: 'Nota__c' } } };
  const f = buildRadar(m, [{ file: 'x', status: 'modified', meta: { type: 'field', object: 'Account', name: 'Nota__c' } }]);
  assert.deepEqual(f.tests.map((t) => t.name), ['UsaCampoTest']);
  const rt = buildRadar(m, [{ file: 'x', status: 'modified', meta: { type: 'recordType', object: 'Account', name: 'Varejo' } }]);
  assert.deepEqual(rt.tests.map((t) => t.name), ['TipoTest']);
});

test('field references: method returns, nested collections, inner classes, safe navigation and binds', () => {
  const { apexFieldRefs } = require('../modules/sf/indexer/fieldrefs');
  const { refs } = apexFieldRefs(`public class Tela {
    public class Linha { public Nota__c nota; }
    public static void a(Map<Id, List<Nota__c>> porConta, Contact c, Linha l, Nota__c n) {
      Decimal x = porConta.get(c.Id)[0].Valor__c;
      Boolean y = Ajustes.atuais().Ativo__c;
      Decimal z = l.nota.Valor__c;
      Decimal w = n?.Valor__c;
      List<Account> contas = [SELECT Id FROM Account WHERE Nota_Id__c = :n.Valor__c];
      System.assert(true, 'Valor__c deve estar preenchido');
    } }`);
  const by = (f, line) => refs.filter((r) => r.field === f && r.line === line).map((r) => `${r.base}|${r.path.join('.')}`);
  assert.deepEqual(by('Valor__c', 4), ['Nota__c|Valor__c']);
  assert.deepEqual(by('Ativo__c', 5), ['ret:Ajustes.atuais|Ativo__c']);
  assert.deepEqual(by('Valor__c', 6), ['Linha|nota.Valor__c']);
  assert.deepEqual(by('Valor__c', 7), ['Nota__c|Valor__c']);
  assert.deepEqual(by('Valor__c', 8), ['Nota__c|Valor__c'], 'the bind :n.Valor__c is the Apex variable');
  assert.deepEqual(by('Nota_Id__c', 8), ['Account|Nota_Id__c']);
  assert.ok(refs.some((r) => r.line === 9 && r.prose), 'a sentence is not a use');
});

test('field references in metadata: console mappings, flow choice sets, and prose', () => {
  const { metaFieldRefs, flowFieldRefs } = require('../modules/sf/indexer/fieldrefs');
  const app = metaFieldRefs('force-app/main/default/applications/Vendas.app-meta.xml', '<CustomApplication><workspaceConfig><mappings><fieldName>Loja__c</fieldName><tab>Pedido__c</tab></mappings><mappings><tab>Loja__c</tab></mappings></workspaceConfig></CustomApplication>');
  assert.deepEqual(app.map((r) => `${r.field}|${r.base}`), ['Loja__c|Pedido__c'], 'the tab is an object, the fieldName its field');
  const flow = flowFieldRefs({ dynamicChoiceSets: [{ name: 'Lojas', object: 'Loja__c', displayField: 'Apelido__c' }] }, null, '<Flow/>');
  assert.ok(flow.some((r) => r.field === 'Apelido__c' && r.base === 'Loja__c'));
  const fn = metaFieldRefs('force-app/main/default/genAiFunctions/X/X.genAiFunction-meta.xml', '<GenAiFunction><description\n>Shows details about an Experience__c record.</description><instruction>Look up the Experience__c the user wants to know about</instruction></GenAiFunction>');
  assert.ok(fn.every((r) => r.prose), 'sentences in metadata are not uses');
});
