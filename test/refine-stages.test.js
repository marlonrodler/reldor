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
const ENV = { ...process.env, RELDOR_SF_BIN: FAKE_SF, SF_TARGET_ORG: '' };
const reldor = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: ENV, input: '' });
const NS = 'xmlns="http://soap.sforce.com/2006/04/metadata"';

// Invented teams VND (sales) and CMP (purchases), and a shared field.
function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-stages-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  const field = (obj, name, label, type = 'Date', extra = '') => {
    const f = path.join(dir, 'force-app/main/default/objects', obj, 'fields', `${name}.field-meta.xml`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, `<?xml version="1.0" encoding="UTF-8"?>\n<CustomField ${NS}><fullName>${name}</fullName><label>${label}</label><type>${type}</type>${extra}</CustomField>\n`);
  };
  field('Account', 'VND_Data_Aprovacao__c', 'Data de aprovação');
  field('Account', 'Data_Revisao__c', 'Data de revisão');
  field('Account', 'CMP_Data_Aprovacao_Compra__c', 'Data de aprovação da compra');
  for (const c of ['VND_PedidoService', 'VND_PedidoSelector', 'CMP_CompraSelector']) fs.writeFileSync(path.join(dir, `force-app/main/default/classes/${c}.cls`), `public with sharing class ${c} {}\n`);
  // The teams, confirmed for the project: one by its word at the start, one by a regular expression.
  fs.mkdirSync(path.join(dir, '.reldor'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.reldor', 'reldor.config.yaml'), 'teams:\n  - name: VND\n    match: vnd\n    where: start\n  - name: CMP\n    regex: "^CMP_"\n');
  fs.writeFileSync(path.join(dir, 'force-app/main/default/classes/CMP_AprovacaoService.cls'), 'public with sharing class CMP_AprovacaoService {\n  public static void marcar(Account a) { a.CMP_Data_Aprovacao_Compra__c = Date.today(); }\n}\n');
  return dir;
}

const TASK = `---
reldor: task
id: "1234"
alvos:
  objetos: [Conta]
  campos: ["Segmento"]
  valores:
    - campo: "Segmento"
      valor: "Private"
  criar:
    - tipo: campo
      nome: "Data de aprovação"
      objeto: Account
      tipo_campo: Date
      sentido: "quando a conta foi aprovada"
---

# Aprovação de conta

## Objetivo
Saber quando a conta foi aprovada.

## Onde
Conta.

## O que muda
- campo novo de data

## Critérios de aceite
- Dado uma conta aprovada, quando abrir, então vejo a data.
`;

test('refine in stages: a task in the standard searches only its targets, and says what can be reused', () => {
  const dir = project();
  fs.mkdirSync(path.join(dir, '.reldor', 'work'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.reldor', 'work', 'task.md'), TASK);
  const r = JSON.parse(reldor(dir, ['refine', '--file', '.reldor/work/task.md', '--json']).stdout);
  assert.equal(r.format.standard, true);
  assert.equal(r.targets.objects[0].ref, 'Account', '"Conta" by its meaning');
  assert.equal(r.targets.fields[0].ref, 'Account.Segmento__c');
  assert.ok(r.values.some((v) => v.value === 'Private' && v.exists));
  assert.deepEqual(r.objects.map((o) => o.name), ['Account'], 'no loose words');

  const reuse = r.reuse[0];
  assert.ok(reuse.candidates.length >= 2, JSON.stringify(reuse));
  const vnd = reuse.candidates.find((c) => c.ref === 'Account.VND_Data_Aprovacao__c');
  assert.equal(vnd.owner, 'VND');
  assert.equal(vnd.pick, 'generico', 'it belongs to another team: create a generic one, do not touch theirs');
  const cmp = reuse.candidates.find((c) => c.ref === 'Account.CMP_Data_Aprovacao_Compra__c');
  if (cmp) assert.ok(cmp.usage.automations >= 1);
  assert.ok(!JSON.stringify(r.reuse).match(/renomear|trocar o nome/i), 'renaming is never suggested');

  // The same, for someone of team VND: reuse their own field.
  fs.writeFileSync(path.join(dir, '.reldor', 'local.yaml'), 'team: VND\n');
  const mine = JSON.parse(reldor(dir, ['refine', '--file', '.reldor/work/task.md', '--json']).stdout);
  assert.equal(mine.reuse[0].candidates.find((c) => c.ref === 'Account.VND_Data_Aprovacao__c').pick, 'reusar');

  // A text that is not in the standard says so.
  fs.writeFileSync(path.join(dir, '.reldor', 'work', 'solta.md'), 'na conta, criar a data de aprovação');
  const loose = JSON.parse(reldor(dir, ['refine', '--file', '.reldor/work/solta.md', '--json']).stdout);
  assert.equal(loose.format.hasTargets, false);
});

test('limits: counted from the project, joined to the task, and the org limits by a read-only command', () => {
  const dir = project();
  const fields = path.join(dir, 'force-app/main/default/objects/Proposta__c/fields');
  for (let i = 0; i < 2; i += 1) fs.writeFileSync(path.join(fields, `Pai${i}__c.field-meta.xml`), `<?xml version="1.0" encoding="UTF-8"?>\n<CustomField ${NS}><fullName>Pai${i}__c</fullName><label>Pai ${i}</label><type>MasterDetail</type><referenceTo>Account</referenceTo></CustomField>\n`);
  const r = JSON.parse(reldor(dir, ['limits', '--json']).stdout);
  assert.ok(r.items.some((i) => i.object === 'Proposta__c' && i.what === 'master-detail' && i.used >= 2 && i.near), JSON.stringify(r.items));

  const L = require('../modules/sf/limits');
  const model = { objects: { Proposta__c: { name: 'Proposta__c', fields: { A: { name: 'Pai0__c', type: 'MasterDetail' }, B: { name: 'Pai1__c', type: 'MasterDetail' } }, validationRules: [] } } };
  const t = L.limitsForTask(model, [{ tipo: 'campo', objeto: 'Proposta__c', tipo_campo: 'MasterDetail' }]);
  assert.match(t[0].text, /passa do limite/);

  const org = JSON.parse(reldor(dir, ['limits', '--org', 'dev-sb', '--json']).stdout).org;
  assert.ok(org.ok);
  assert.deepEqual(org.near.map((l) => l.name), ['DailyApiRequests']);
});

test('targets: standard fields by their label; reuse: a shared field others depend on is reused, not duplicated', () => {
  const { resolveTargets } = require('../modules/sf/refine/targets');
  const model = { objects: { Opportunity: { name: 'Opportunity', fields: {} } }, classes: {}, triggers: {}, flows: {}, lwc: {}, screens: {}, meta: {}, customMetadata: {}, ui: [], permissions: [], application: { services: {}, selectors: {}, domains: {} } };
  const t = resolveTargets(model, { objetos: ['Opportunity'], campos: ['Stage', 'Data de fechamento'] });
  assert.deepEqual(t.fields.map((f) => f.ref), ['Opportunity.StageName', 'Opportunity.CloseDate']);

  const dir = project();
  // A shared field (no team prefix) that a VND class writes.
  fs.writeFileSync(path.join(dir, 'force-app/main/default/classes/VND_RevisaoService.cls'), 'public with sharing class VND_RevisaoService {\n  public static void marcar(Account a) { a.Data_Revisao__c = Date.today(); }\n}\n');
  fs.mkdirSync(path.join(dir, '.reldor', 'work'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.reldor', 'work', 't.md'), '---\nalvos:\n  objetos: [Account]\n  criar:\n    - tipo: campo\n      nome: "Data de revisão"\n      objeto: Account\n      tipo_campo: Date\n---\n# X\n');
  fs.writeFileSync(path.join(dir, '.reldor', 'local.yaml'), 'team: CMP\n');
  const r = JSON.parse(reldor(dir, ['refine', '--file', '.reldor/work/t.md', '--json']).stdout);
  const c = r.reuse[0].candidates.find((x) => x.ref === 'Account.Data_Revisao__c');
  assert.equal(c.owner, null);
  assert.equal(c.pick, 'reusar');
  assert.match(c.why, /VND/);
});
