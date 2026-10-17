'use strict';

// Windows: Git is often set to turn \n into \r\n on checkout (core.autocrlf). The tests build files with \n and
// edit them by text, so they turn that conversion off for every git call, including the ones Reldor makes.
process.env.GIT_CONFIG_COUNT = '1';
process.env.GIT_CONFIG_KEY_0 = 'core.autocrlf';
process.env.GIT_CONFIG_VALUE_0 = 'false';

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

test('reldor collisions: same lines, same file, and metadata the smart merge joins', () => {
  const dir = scenario();
  const C = 'force-app/main/default/classes/ContaController.cls';
  const edit = (line, tag) => {
    const file = path.join(dir, C);
    const rows = fs.readFileSync(file, 'utf8').split('\n');
    rows[line] += ` // ${tag}`;
    fs.writeFileSync(file, rows.join('\n'));
  };
  git(dir, ['checkout', '-qb', 'feature/mesma-linha', 'master']);
  edit(1, 'outra pessoa');
  git(dir, ['commit', '-qam', 'linha 2'], 'ana');
  git(dir, ['checkout', '-qb', 'feature/outra-parte', 'master']);
  edit(4, 'fim');
  git(dir, ['commit', '-qam', 'linha 5'], 'ana');
  git(dir, ['checkout', '-q', 'feature/minha']);
  edit(1, 'minha');
  git(dir, ['commit', '-qam', 'minha linha 2']);
  // By default, branches without a PR and outside the environments are ignored (they may be abandoned).
  const quiet = json(dir, ['collisions']);
  assert.deepEqual(quiet.collisions.map((c) => c.branch), ['feature/outra'], 'only the branch already in develop');
  assert.deepEqual(quiet.collisions[0].reached, ['develop']);
  assert.equal(quiet.ignored, 2);
  const r = json(dir, ['collisions', '--all']);
  const risk = Object.fromEntries(r.collisions.map((c) => [c.branch, c.files.map((f) => `${f.file.split('/').pop()}:${f.risk}`).join()]));
  assert.equal(risk['feature/mesma-linha'], 'ContaController.cls:alto');
  assert.equal(risk['feature/outra-parte'], 'ContaController.cls:médio');
  assert.equal(risk['feature/outra'], 'Gestao_Contas.permissionset-meta.xml:baixo');
});

test('reldor rollback: what goes back, what must be deleted, and what still uses it', () => {
  const dir = scenario();
  git(dir, ['checkout', '-q', 'master']);
  git(dir, ['merge', '-q', '--no-ff', '-m', 'Merge pull request #123 from org/feature/outra', 'feature/outra']);
  // After the PR, someone starts using the new field.
  write(dir, 'force-app/main/default/classes/Usa.cls', 'public class Usa { Object x(Account a) { return a.Perfil_Risco__c; } }\n');
  git(dir, ['add', '-A'], 'ana');
  git(dir, ['commit', '-qm', 'usa o campo'], 'ana');
  const plan = json(dir, ['rollback', '123']);
  assert.deepEqual(plan.commits.map((c) => c.subject), ['outra: campo']);
  assert.deepEqual(plan.destructive.map((d) => `${d.type} ${d.member}`), ['CustomField Account.Perfil_Risco__c']);
  assert.deepEqual(plan.restore.map((d) => `${d.type} ${d.member}`), ['PermissionSet Gestao_Contas']);
  assert.deepEqual(plan.stillUsed.map((s) => s.files), [['force-app/main/default/classes/Usa.cls']]);
  const xml = fs.readFileSync(path.join(dir, plan.manifests.destructive), 'utf8');
  assert.match(xml, /<members>Account\.Perfil_Risco__c<\/members>\s*<name>CustomField<\/name>/);
  assert.deepEqual(plan.environments, ['develop', 'production']);
});

test('reldor status warns, by itself, what would go wrong in the next environment', () => {
  const dir = scenario();
  reldor(dir, ['merge', 'install']);
  git(dir, ['checkout', '-qb', 'merge/minha-develop', 'develop']);
  git(dir, ['merge', '-q', '--no-edit', 'feature/minha']);
  git(dir, ['checkout', '-q', 'develop']);
  git(dir, ['merge', '-q', '--no-edit', 'merge/minha-develop']);
  git(dir, ['checkout', '-q', 'feature/minha']);
  const s = json(dir, ['status', '--no-cli']);
  assert.ok(s.alerts.some((a) => a.level === 'alta' && a.text.includes('Perfil_Risco__c') && a.text.includes('uat')), JSON.stringify(s.alerts));
  assert.equal(s.next.id, 'fix');
  assert.match(reldor(dir, ['status', '--no-cli']).stdout, /Avisos \(se subir agora\)/);
  assert.deepEqual(json(dir, ['status', '--no-cli', '--quick']).alerts, []);
});
