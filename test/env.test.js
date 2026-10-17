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
const YAML = require('yaml');
const { productionEnv, baseBranch, branchName } = require('../core/config');
const { resolveOrg } = require('../modules/sf/org/guard');

const CLI = path.join(__dirname, '..', 'core', 'cli', 'index.js');
const git = (cwd, args) => spawnSync('git', ['-c', 'user.name=dev', '-c', 'user.email=dev@x', ...args], { cwd, encoding: 'utf8' });
const reldor = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });

test('the chain is configuration, not code: any names, any branches, any length', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-env-'));
  fs.writeFileSync(path.join(dir, 'sfdx-project.json'), '{"packageDirectories":[{"path":"force-app"}]}');
  git(dir, ['init', '-q', '-b', 'trunk']);
  git(dir, ['commit', '-q', '--allow-empty', '-m', 'base']);
  for (const b of ['qa/x', 'hml/y', 'stg/z']) git(dir, ['branch', b]);

  assert.equal(reldor(dir, ['env', 'set', 'qa:qa/x, hml:hml/y, stg:stg/z, prd:trunk', '--merge-branch', 'mrg/{env}/{feature}']).status, 0);
  const cfg = YAML.parse(fs.readFileSync(path.join(dir, '.reldor', 'reldor.config.yaml'), 'utf8'));
  assert.deepEqual(cfg.environments.map((e) => `${e.name}:${e.branch}`), ['qa:qa/x', 'hml:hml/y', 'stg:stg/z', 'prd:trunk']);
  assert.equal(productionEnv(cfg).name, 'prd');
  assert.equal(baseBranch(cfg), 'trunk');
  assert.equal(branchName(cfg.git.merge_branch, { env: 'qa', feature: 'feature/123' }), 'mrg/qa/feature/123');

  // Production can be any environment, and the base branch can be another one.
  reldor(dir, ['env', '--production', 'stg', '--base', 'hml/y']);
  const cfg2 = YAML.parse(fs.readFileSync(path.join(dir, '.reldor', 'reldor.config.yaml'), 'utf8'));
  assert.equal(productionEnv(cfg2).name, 'stg');
  assert.equal(baseBranch(cfg2), 'hml/y');
  assert.equal(resolveOrg({ ...cfg2, environments: cfg2.environments.map((e) => ({ ...e, org: `${e.name}-org` })) }, { org: 'stg-org' }).production, true);
  assert.equal(resolveOrg({ ...cfg2, environments: cfg2.environments.map((e) => ({ ...e, org: `${e.name}-org` })) }, { org: 'qa-org' }).production, false);

  const s = JSON.parse(reldor(dir, ['status', '--json', '--no-cli', '--quick']).stdout);
  assert.deepEqual(s.environments.items.map((i) => i.name), ['qa', 'hml', 'stg', 'prd']);
});
