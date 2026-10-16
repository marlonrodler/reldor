'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { mergeXml } = require('../modules/sf/merge/xml-merge');

const CLI = path.join(__dirname, '..', 'core', 'cli', 'index.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-sf');
const PS = 'force-app/main/default/permissionsets/Gestao_Contas.permissionset-meta.xml';
const FIELD = 'force-app/main/default/objects/Account/fields/Perfil_Risco__c.field-meta.xml';
const CLS = 'force-app/main/default/classes/RiscoService.cls';

const git = (cwd, args, who = 'dev') => spawnSync('git', ['-c', `user.name=${who}`, '-c', `user.email=${who}@x`, ...args], { cwd, encoding: 'utf8' });
const reldor = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
const json = (cwd, args) => JSON.parse(reldor(cwd, [...args, '--json']).stdout);
const write = (dir, file, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), text);
};
const addClassAccess = (dir, cls) => {
  const file = path.join(dir, PS);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('</classAccesses>', `</classAccesses>\n    <classAccesses><apexClass>${cls}</apexClass><enabled>true</enabled></classAccesses>`));
};

const ps = (...cls) => `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
${cls.map(([c, on]) => `    <classAccesses>\n        <apexClass>${c}</apexClass>\n        <enabled>${on}</enabled>\n    </classAccesses>`).join('\n')}
    <label>Gestao</label>
</PermissionSet>
`;

test('XML merge: different items on each side join; the same item changed twice is the only conflict', () => {
  const base = ps(['A', 'true'], ['C', 'true']);
  const r = mergeXml(base, ps(['A', 'true'], ['B', 'true'], ['C', 'true']), ps(['A', 'true'], ['C', 'false'], ['D', 'true']));
  assert.deepEqual(r.conflicts, []);
  assert.equal(r.text, ps(['A', 'true'], ['B', 'true'], ['C', 'false'], ['D', 'true']));
  const c = mergeXml(base, ps(['A', 'false'], ['C', 'true']), ps(['A', 'true'], ['C', 'true'], ['E', 'true']).replace('<enabled>true</enabled>', '<enabled>x</enabled>'));
  assert.deepEqual(c.conflicts, [{ section: 'classAccesses', key: 'A' }]);
  assert.match(c.text, /^<<<<<<< ours$/m);
  assert.match(c.text, /<apexClass>E<\/apexClass>/);
  assert.equal(mergeXml('', '<a/>', '<a/>').supported, false);
});

/** master -> develop -> rc/uat, a colleague's field only in develop, and my feature that uses it. */
function scenario() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-promo-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  write(dir, '.reldor/reldor.config.yaml', 'modules: [sf]\nenvironments:\n  - name: develop\n    branch: develop\n  - name: uat\n    branch: rc/uat\n  - name: production\n    branch: master\n');
  write(dir, '.gitignore', '.reldor/cache/\n.reldor/log/\n.reldor/work/\n');
  git(dir, ['init', '-q', '-b', 'master']);
  git(dir, ['config', 'user.email', 'dev@x']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'base']);
  git(dir, ['branch', 'develop']);
  git(dir, ['branch', 'rc/uat']);
  git(dir, ['checkout', '-qb', 'feature/outra']);
  write(dir, FIELD, '<?xml version="1.0" encoding="UTF-8"?>\n<CustomField xmlns="http://soap.sforce.com/2006/04/metadata"><fullName>Perfil_Risco__c</fullName><type>Text</type></CustomField>\n');
  addClassAccess(dir, 'Outra');
  git(dir, ['add', '-A'], 'ana');
  git(dir, ['commit', '-qm', 'outra: campo'], 'ana');
  git(dir, ['checkout', '-q', 'develop']);
  git(dir, ['merge', '-q', '--no-ff', '--no-edit', 'feature/outra']);
  git(dir, ['checkout', '-qb', 'feature/minha', 'master']);
  write(dir, CLS, 'public with sharing class RiscoService {\n  public static String perfil(Account conta) { return conta.Perfil_Risco__c; }\n}\n');
  addClassAccess(dir, 'RiscoService');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'minha: RiscoService']);
  return dir;
}

test('reldor promote: profile conflict is resolvable, order, missing field, and the merge driver', () => {
  const dir = scenario();
  const dev = json(dir, ['promote', 'develop']);
  assert.equal(dev.commits.length, 1);
  assert.deepEqual(dev.conflicts.map((c) => [c.file, c.resolvable]), [[PS, true]]);
  assert.deepEqual(dev.missing, []);

  // Going to UAT before develop: the pipeline would block.
  assert.equal(json(dir, ['promote', 'uat']).notInPrevious.length, 1);

  // With the merge driver, a plain `git merge` joins the permission set by itself.
  reldor(dir, ['merge', 'install']);
  git(dir, ['checkout', '-qb', 'merge/minha-develop', 'develop']);
  const merged = git(dir, ['merge', '--no-edit', 'feature/minha']);
  assert.equal(merged.status, 0, merged.stdout + merged.stderr);
  const text = fs.readFileSync(path.join(dir, PS), 'utf8');
  assert.ok(text.includes('<apexClass>Outra</apexClass>') && text.includes('<apexClass>RiscoService</apexClass>'));
  git(dir, ['checkout', '-q', 'develop']);
  git(dir, ['merge', '-q', '--no-edit', 'merge/minha-develop']);
  git(dir, ['checkout', '-q', 'feature/minha']);

  // Now in develop; UAT does not have the colleague's field.
  const uat = json(dir, ['promote', 'uat']);
  assert.deepEqual(uat.notInPrevious, []);
  assert.deepEqual(uat.missing.map((m) => [m.item, m.presentIn]), [['Perfil_Risco__c', ['develop']]]);
  assert.equal(uat.foreign, null);

  // A branch that pulled develop in carries someone else's commit.
  git(dir, ['checkout', '-qb', 'feature/misturada', 'master']);
  git(dir, ['merge', '-q', '--no-edit', 'develop']);
  const mixed = json(dir, ['promote', 'uat']);
  assert.deepEqual(mixed.foreign.commits.map((c) => c.author), ['ana']);
  assert.deepEqual(mixed.foreign.from, ['develop']);
});
