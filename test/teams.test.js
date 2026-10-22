'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { compileTeams, ownerOf, nameTokens } = require('../modules/sf/teams');

const CLI = path.join(__dirname, '..', 'core', 'cli', 'index.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-sf');
const ENV = { ...process.env, RELDOR_SF_BIN: '/nonexistent', SF_TARGET_ORG: '' };
const reldor = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: ENV, input: '' });
const CLASSES = 'force-app/main/default/classes';

test('teams: a name shows its team at the start, middle or end, with or without a separator; only what is confirmed counts', () => {
  assert.deepEqual(nameTokens('OpportunityVendasService'), ['opportunity', 'vendas', 'service']);
  assert.deepEqual(nameTokens('VNDPedido__c'), ['vnd', 'pedido']);
  const teams = compileTeams([{ name: 'vendas', match: 'vendas' }, { name: 'compras', match: 'cmp', where: 'start' }, { name: 'cx', folder: 'force-app/cx' }, { name: 'x', regex: '^XX\\d' }]);
  assert.equal(ownerOf('OpportunityVendasService', teams), 'vendas');
  assert.equal(ownerOf('Service_Vendas', teams), 'vendas');
  assert.equal(ownerOf('vendas-tela', teams), 'vendas');
  assert.equal(ownerOf('CMP_Pedido__c', teams), 'compras');
  assert.equal(ownerOf('PedidoCmp', teams), null, 'compras is only at the start');
  assert.equal(ownerOf('Qualquer', teams, 'force-app/cx/classes/Qualquer.cls'), 'cx');
  assert.equal(ownerOf('XX1Job', teams), 'x');
  assert.equal(ownerOf('CPF_Valida', teams), null, 'nothing is guessed');
});

test('reldor teams: suggests repeated words, saves what is confirmed; me and helpers use it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-teams-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  const cls = (name, body) => fs.writeFileSync(path.join(dir, CLASSES, `${name}.cls`), body);
  for (const n of ['PedidoVendasService', 'VendasSelector', 'Vendas_Relatorio', 'TelaVendasController', 'VendasBatch']) cls(n, `public with sharing class ${n} {\n  public static String formatarDocumento(String v) { return v; }\n}\n`);
  cls('CompraService', 'public with sharing class CompraService {\n  public static String formatarDocumento(String v, Boolean m) { return v; }\n}\n');
  cls('StringUtils', 'public with sharing class StringUtils {\n  public static String formatarCpf(String cpf) { return cpf; }\n}\n');
  reldor(dir, ['init', '--no-cli']);

  const s = JSON.parse(reldor(dir, ['teams', '--json']).stdout);
  assert.ok(s.suggestions.some((x) => x.word === 'vendas' && x.total >= 5), JSON.stringify(s.suggestions));
  assert.deepEqual(s.teams, []);
  assert.match(fs.readFileSync(path.join(dir, '.reldor', 'profile.md'), 'utf8'), /Times ainda não confirmados/);

  assert.equal(reldor(dir, ['teams', 'add', 'vendas', '--match', 'vendas']).status, 0);
  const after = JSON.parse(reldor(dir, ['teams', '--json']).stdout);
  assert.equal(after.found[0].classes, 5);
  assert.equal(JSON.parse(reldor(dir, ['me', '--team', 'vendas', '--json']).stdout).teamConfirmed, true);
  assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /\.reldor\/local\.yaml/);

  const h = JSON.parse(reldor(dir, ['helpers', 'formatar', '--json']).stdout);
  assert.equal(h.results[0].shared, true, 'shared code first');
  assert.ok(h.results.some((r) => r.owner === 'vendas'));
  const sim = JSON.parse(reldor(dir, ['helpers', '--similar', '--json']).stdout).similar.find((g) => g.method === 'formatarDocumento');
  assert.deepEqual(sim.owners.sort(), ['compartilhado', 'vendas']);
  assert.equal(reldor(dir, ['teams', 'remove', 'vendas']).status, 0);
  assert.deepEqual(JSON.parse(reldor(dir, ['teams', '--json']).stdout).teams, []);
});
