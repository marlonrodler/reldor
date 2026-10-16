'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildIndex } = require('../modules/sf/indexer');
const { explainObject } = require('../modules/sf/explain');
const { findUsages } = require('../modules/sf/checks/usages');
const { parseApexClass, parseSoql } = require('../modules/sf/indexer/apex');

const FIXTURE = path.join(__dirname, 'fixtures', 'sample-sf');

function copyFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-sf-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (src) => !src.includes(`${path.sep}.reldor`) });
  return dir;
}

test('SOQL parser reads object and fields, ignoring subqueries', () => {
  const q = parseSoql('x = [SELECT Id, Name, (SELECT Id FROM Contacts), Owner.Name FROM Account WHERE Id = :id];');
  assert.deepEqual(q, [{ object: 'Account', fields: ['Id', 'Name', 'Owner.Name'] }]);
});

test('Apex parser detects kinds, selector fields and enqueued jobs', () => {
  const c = parseApexClass('S', `public class S extends fflib_SObjectSelector {
    public Schema.SObjectType getSObjectType() { return Account.SObjectType; }
    public List<Schema.SObjectField> getSObjectFieldList() { return new List<Schema.SObjectField>{ Account.Id, Account.CPF__c }; }
    void x() { System.enqueueJob(new Job()); } }`);
  assert.ok(c.kinds.includes('selector'));
  assert.equal(c.selectorObject, 'Account');
  assert.deepEqual(c.selectorFields, ['Account.Id', 'Account.CPF__c']);
  assert.deepEqual(c.enqueues, ['Job']);
});

test('index builds the model and reuses unchanged files', () => {
  const dir = copyFixture();
  const first = buildIndex(dir, { full: true });
  assert.equal(first.stats.errors, 0);
  assert.equal(first.stats.parsed, first.stats.files);
  const a = first.model.objects.Account;
  assert.deepEqual(a.triggers, ['AccountTrigger']);
  assert.deepEqual(a.selectors, ['AccountsSelector']);
  assert.equal(a.domain, 'Accounts');
  assert.deepEqual(first.model.objects.Proposta__c.rollupsTo.map((r) => r.parent), ['Account']);

  const second = buildIndex(dir);
  assert.equal(second.stats.parsed, 0);
  assert.equal(second.stats.reused, first.stats.files);

  const cls = path.join(dir, 'force-app', 'main', 'default', 'classes', 'ScoreJob.cls');
  fs.appendFileSync(cls, '\n// alterado');
  assert.equal(buildIndex(dir).stats.parsed, 1);
});

test('explain follows the order of execution and the fflib chain', () => {
  const { model } = buildIndex(copyFixture(), { full: true });
  const r = explainObject(model, 'Account', 'update');
  const titles = r.steps.map((s) => s.title);
  assert.deepEqual(titles, [
    'Flows antes de salvar (before-save)',
    'Triggers before',
    'Regras de validação',
    'Triggers after',
    'Workflow rules (legado)',
    'Flows depois de salvar (after-save)',
    'Assíncrono (depois do commit)',
  ]);
  const before = r.steps[1].items[0];
  assert.deepEqual(before.chain.map((c) => c.name), ['Accounts', 'AccountsServiceImpl', 'ScoreJob']);
  const after = r.steps[3].items[0];
  assert.equal(after.idle, true, 'domain has no onAfterUpdate');
  assert.equal(r.steps[6].items[0].name, 'ScoreJob');
  assert.deepEqual(r.bypass, ['Bypass__c']);
  assert.deepEqual(r.inactiveFlows, ['Rascunho']);
  assert.deepEqual(r.tests.direct, ['AccountsTest']);

  const child = explainObject(model, 'Proposta__c', 'insert');
  assert.equal(child.steps[0].title, 'Efeito em cascata');
});

test('usages finds fields, classes, methods and text-only references', () => {
  const { model } = buildIndex(copyFixture(), { full: true });
  const where = (q) => findUsages(model, q).map((h) => `${h.where}:${h.name}:${h.certainty}`);

  assert.deepEqual(where('CPF__c').slice(0, 3), ['Validation rule:Account.CPF_Obrigatorio:certo', 'Selector:AccountsSelector:certo', 'Apex:AccountsTest:certo']);
  assert.ok(where('Account.Score__c').includes('Flow:Conta_Depois_Salvar:certo'));
  assert.ok(where('Account.Score__c').includes('LWC:contaScore:certo'));
  assert.ok(where('AccountsServiceImpl').includes('Apex:ContaController:possível'));
  assert.ok(where('AccountsServiceImpl.calcularScore').includes('Apex:Accounts:provável'));
  assert.deepEqual(where('Proposta__c'), ['Apex:ScoreJob:certo', 'Roll-up:Account.Total_Propostas__c:certo']);
});

test('trigger handlers follow only the methods of the phase, including private helpers', () => {
  const { handlerRefs } = require('../modules/sf/indexer/apex');
  const refs = handlerRefs(`public class H extends TriggerHandler {
    override public void afterInsert() { ajudar(); }
    private void ajudar() { Servico.rodar(); }
    public override void onValidate(Map<Id, SObject> existing) { Validador.ok(); }
    public void outro() { Nada.x(); } }`);
  assert.ok(refs['afterInsert/0'].includes('Servico'));
  assert.ok(!refs['afterInsert/0'].includes('Nada'));
  assert.ok(refs['onValidate/1'].includes('Validador'), 'generic parameters count as one');
});

test('usages also finds layouts, permission sets and class access', () => {
  const { model } = buildIndex(copyFixture(), { full: true });
  const where = (q) => findUsages(model, q).map((h) => `${h.where}:${h.name}`);
  assert.ok(where('Account.CPF__c').includes('Layout:Account-Conta Layout'));
  assert.ok(where('Account.CPF__c').includes('Permission set:Gestao_Contas'));
  assert.ok(where('ContaController').includes('Permission set:Gestao_Contas'));
});
