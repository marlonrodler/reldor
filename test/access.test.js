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
const NS = 'xmlns="http://soap.sforce.com/2006/04/metadata"';

// Account.Etapa__c (A1, B2, C3, Nova): "Nova" exists but is not enabled everywhere.
function project() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-access-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  const base = path.join(dir, 'force-app', 'main', 'default');
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true });
    fs.writeFileSync(path.join(base, rel), `<?xml version="1.0" encoding="UTF-8"?>\n${text}\n`);
  };
  const vals = (list) => list.map((v) => `<value><fullName>${v}</fullName><default>false</default><label>${v}</label></value>`).join('');
  put('objects/Account/fields/Etapa__c.field-meta.xml', `<CustomField ${NS}><fullName>Etapa__c</fullName><label>Etapa</label><type>Picklist</type><valueSet><valueSetDefinition>${vals(['A1', 'B2', 'C3', 'Nova'])}</valueSetDefinition></valueSet></CustomField>`);
  const rt = (name, list) => put(`objects/Account/recordTypes/${name}.recordType-meta.xml`, `<RecordType ${NS}><fullName>${name}</fullName><active>true</active><label>${name}</label><picklistValues><picklist>Etapa__c</picklist>${list.map((v) => `<values><fullName>${v}</fullName><default>false</default></values>`).join('')}</picklistValues></RecordType>`);
  rt('Varejo', ['A1', 'B2', 'C3']);
  rt('Atacado', ['A1', 'B2', 'C3', 'Nova']);
  put('profiles/Vendedor.profile-meta.xml', `<Profile ${NS}><fieldPermissions><editable>true</editable><field>Account.Etapa__c</field><readable>true</readable></fieldPermissions><layoutAssignments><layout>Account-Varejo Layout</layout><recordType>Account.Varejo</recordType></layoutAssignments></Profile>`);
  put('permissionsets/Leitura.permissionset-meta.xml', `<PermissionSet ${NS}><label>Leitura</label></PermissionSet>`);
  put('layouts/Account-Varejo Layout.layout-meta.xml', `<Layout ${NS}><layoutSections><layoutColumns><layoutItems><field>Name</field></layoutItems></layoutColumns></layoutSections></Layout>`);
  put('pathAssistants/Etapa_Path.pathAssistant-meta.xml', `<PathAssistant ${NS}><active>true</active><fieldName>Etapa__c</fieldName><sobjectType>Account</sobjectType>${['A1', 'B2', 'C3'].map((v) => `<pathAssistantSteps><picklistValueName>${v}</picklistValueName></pathAssistantSteps>`).join('')}</PathAssistant>`);
  put('objectTranslations/Account-pt_BR/Etapa__c.fieldTranslation-meta.xml', `<CustomFieldTranslation ${NS}><name>Etapa__c</name>${['A1', 'B2', 'C3'].map((v) => `<picklistValues><masterLabel>${v}</masterLabel><translation>${v}</translation></picklistValues>`).join('')}</CustomFieldTranslation>`);
  put('objects/Account/validationRules/Etapa_Valida.validationRule-meta.xml', `<ValidationRule ${NS}><fullName>Etapa_Valida</fullName><active>true</active><errorConditionFormula>NOT(ISPICKVAL(Etapa__c, 'A1') || ISPICKVAL(Etapa__c, 'B2'))</errorConditionFormula><errorMessage>x</errorMessage></ValidationRule>`);
  return dir;
}

test('access: the value exists, and every place that still has to enable it', () => {
  const dir = project();
  const r = JSON.parse(reldor(dir, ['access', 'Account.Etapa__c', '--value', 'nova', '--json']).stdout);
  assert.equal(r.valueFound, 'Nova');
  const areas = r.gaps.map((g) => `${g.area}:${g.where}`);
  assert.ok(areas.includes('record type:Account.Varejo'), JSON.stringify(areas));
  assert.ok(!areas.includes('record type:Account.Atacado'), 'Atacado already has it');
  assert.ok(areas.some((a) => a.startsWith('layout:Account-Varejo Layout')), 'the layout of the Varejo record type lacks the field');
  assert.ok(areas.includes('path:Etapa_Path'));
  assert.ok(areas.some((a) => a.startsWith('tradução:')));
  assert.ok(r.gaps.some((g) => g.area === 'validation rule' && /Etapa_Valida/.test(g.where)), 'a rule lists the other values');
  assert.deepEqual(r.details.access.edit, ['Vendedor (profile)']);
  assert.ok(r.details.access.none.includes('Leitura'));

  // Only the record type and the permission set of the task.
  const only = JSON.parse(reldor(dir, ['access', 'Account.Etapa__c', '--value', 'Nova', '--rt', 'Atacado', '--perms', 'Leitura', '--json']).stdout);
  assert.ok(!only.gaps.some((g) => g.where === 'Account.Varejo'));
  assert.ok(only.gaps.some((g) => g.area === 'acesso ao campo' && g.where === 'Leitura'));

  // A value that does not exist: what to create, a similar one, and where to enable it after.
  const missing = JSON.parse(reldor(dir, ['access', 'Account.Etapa__c', '--value', 'Novo', '--json']).stdout);
  assert.match(missing.gaps[0].what, /Parecidos que já existem: "Nova"/);
  assert.ok(missing.gaps.some((g) => /Depois de criar/.test(g.what)));

  // Object and class.
  assert.equal(reldor(dir, ['access', 'Account']).status, 0);
  assert.match(reldor(dir, ['access', 'ContaController']).stdout, /Liberada em 1: Gestao_Contas/);
});

test('refine: a long task by file; with the objects the AI chose, loose words stay out; values point to access', () => {
  const dir = project();
  fs.mkdirSync(path.join(dir, '.reldor', 'work'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.reldor', 'work', 'task.md'), `Na conta, incluir a etapa "Nova" para o time de vendas.\n${'Contexto da task. '.repeat(200)}`);
  const r = JSON.parse(reldor(dir, ['refine', '--file', '.reldor/work/task.md', '--objects', 'Account', '--values', 'Account.Etapa__c=Nova', '--json']).stdout);
  assert.deepEqual(r.objects.map((o) => o.name), ['Account']);
  const v = r.values.find((x) => x.value === 'Nova');
  assert.ok(v && v.exists, JSON.stringify(r.values));
  assert.match(v.check, /reldor access Account\.Etapa__c --value "Nova"/);
  assert.ok(r.attention.some((a) => /já existe em Account\.Etapa__c/.test(a)));
  assert.equal(reldor(dir, ['refine', '--file', 'nao-existe.md']).status, 1);
});
