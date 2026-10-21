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

test('init asks nothing and writes only what it found; profile.md comes from the index and keeps the team part', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-profile-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  const r = reldor(dir, ['init', '--no-cli', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.created, true);
  assert.equal(j.execute, 'off');
  assert.equal(JSON.parse(reldor(dir, ['init', '--json']).stdout).created, false);
  const config = fs.readFileSync(path.join(dir, '.reldor', 'reldor.config.yaml'), 'utf8');
  assert.match(config, /execute: off/);
  assert.doesNotMatch(config, /environments|reference_org/);

  const file = path.join(dir, '.reldor', 'profile.md');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /10 classes Apex \(\+ 2 de teste\), 1 triggers, 3 flows, 1 LWCs/);
  assert.match(text, /fflib \(1 services, 1 selectors, 1 domains\)/);
  assert.match(text, /termina com Test/);

  // The team writes its part; a refresh rewrites only the automatic part.
  fs.writeFileSync(file, text.replace('- Prefixos ou pastas por time:', '- Prefixos ou pastas por time: VND_ vendas').replace('Versão da API: 61.0', 'Versão da API: velha'));
  assert.equal(reldor(dir, ['profile']).status, 0);
  const after = fs.readFileSync(file, 'utf8');
  assert.match(after, /VND_ vendas/);
  assert.match(after, /Versão da API: 61\.0/);
  assert.equal(after.split('## Padrões da equipe').length, 2);

  // An old profile without markers keeps its team section.
  fs.writeFileSync(file, '# Perfil do projeto\n\n- antigo\n\n## Padrões da equipe\n\n- regra do time\n');
  reldor(dir, ['profile']);
  const old = fs.readFileSync(file, 'utf8');
  assert.match(old, /regra do time/);
  assert.doesNotMatch(old, /- antigo/);
});
