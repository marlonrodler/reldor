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
const { tokenize, stripComments } = require('../modules/sf/quality/tokens');
const { findDuplicateBlocks } = require('../modules/sf/quality/duplicates');
const { normalizeSoql } = require('../modules/sf/quality/repetition');

const CLI = path.join(__dirname, '..', 'core', 'cli', 'index.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-sf');
const ENV = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const CLS = 'force-app/main/default/classes';

const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...ENV } });
const reldor = (cwd, args) => JSON.parse(spawnSync(process.execPath, [CLI, ...args, '--no-analyzer', '--json'], { cwd, encoding: 'utf8', env: { ...process.env, ...ENV } }).stdout);

/** A method long enough to be a real copy (about 90 tokens, 12 lines). */
const BODY = (name, msg) => `  public static Decimal ${name}(List<Opportunity> opps) {
    Decimal total = 0;
    for (Opportunity o : opps) {
      if (o.Amount == null) {
        continue;
      }
      Decimal desconto = o.Amount > 10000 ? 0.1 : 0.05;
      total += o.Amount - (o.Amount * desconto);
      System.debug('${msg}' + total);
    }
    return total.setScale(2);
  }`;

const META = '<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>61.0</apiVersion><status>Active</status></ApexClass>';

function project(extra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-q-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (src) => !src.includes(`${path.sep}.reldor`) });
  fs.writeFileSync(path.join(dir, '.gitignore'), '.reldor/work/\n.reldor/cache/\n.reldor/log/\n');
  for (const [name, text] of Object.entries(extra)) {
    fs.writeFileSync(path.join(dir, CLS, `${name}.cls`), text);
    fs.writeFileSync(path.join(dir, CLS, `${name}.cls-meta.xml`), META);
  }
  git(dir, ['init', '-q', '-b', 'master']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'base']);
  return dir;
}

test('tokenizer: comments go, strings and numbers become placeholders, "//" inside a string survives', () => {
  const { tokens } = tokenize("String u = 'http://x'; // fim\n/* bloco\n */ Integer n = 42;");
  assert.deepEqual(tokens.map((t) => t.value), ['string', 'u', '=', '<str>', ';', 'integer', 'n', '=', '<num>', ';']);
  assert.equal(tokens.at(-1).line, 3);
  assert.equal(stripComments("a // b\nc").split('\n').length, 2);
});

test('copied block is found, but only when it touches added lines', () => {
  const a = tokenize(`public class A {\n${BODY('soma', 'a')}\n}`);
  const b = tokenize(`public class B {\n  Integer x = 1;\n${BODY('calcula', 'outro texto')}\n}`);
  const sources = new Map([['A.cls', a], ['B.cls', b]]);
  const hit = findDuplicateBlocks(sources, new Map([['B.cls', new Set([5])]]), { minTokens: 40, minLines: 6 });
  assert.equal(hit.length, 1);
  assert.equal(hit[0].other, 'A.cls');
  assert.deepEqual(findDuplicateBlocks(sources, new Map([['B.cls', new Set([2])]]), { minTokens: 40, minLines: 6 }), []);
});

test('SOQL normalization ignores binds, literals and spacing', () => {
  assert.equal(normalizeSoql("SELECT Id  FROM Account WHERE Name = 'x' AND Id IN :ids LIMIT 10"), normalizeSoql('select id from account where name = \'y\' and id in : outros limit 5'));
});

test('reldor quality: reports the copy and the repeated query a new class creates, not old repetition', () => {
  const query = '  public static List<Account> contas(Set<Id> ids) { return [SELECT Id, Name FROM Account WHERE Id IN :ids]; }';
  const dir = project({
    Calculos: `public with sharing class Calculos {\n${BODY('soma', 'total')}\n${query}\n}`,
    Antiga: `public with sharing class Antiga {\n${BODY('soma2', 'total')}\n}`,
  });
  // A brand new class with the same method and the same query
  fs.writeFileSync(path.join(dir, CLS, 'Nova.cls'), `public with sharing class Nova {\n${BODY('calcularTotal', 'novo')}\n${query.replace('contas', 'buscar')}\n}`);
  fs.writeFileSync(path.join(dir, CLS, 'Nova.cls-meta.xml'), META);
  const r = reldor(dir, ['quality']);
  const kinds = r.findings.map((f) => `${f.file.split('/').pop()}:${f.kind}`);
  assert.ok(kinds.includes('Nova.cls:bloco-copiado'), kinds.join());
  assert.ok(kinds.includes('Nova.cls:soql-repetida'), kinds.join());
  assert.ok(!kinds.some((k) => k.startsWith('Antiga')), 'old repetition is not reported');

  // Touching an old file away from its copied block reports nothing
  fs.rmSync(path.join(dir, CLS, 'Nova.cls'));
  fs.rmSync(path.join(dir, CLS, 'Nova.cls-meta.xml'));
  fs.appendFileSync(path.join(dir, CLS, 'Antiga.cls'), '// revisado\n');
  assert.deepEqual(reldor(dir, ['quality', `${CLS}/Antiga.cls`]).findings, []);

  // --all reviews everything as new: the old copy shows up once
  const all = reldor(dir, ['quality', '--all']).findings.filter((f) => f.kind === 'bloco-copiado' && /Calculos|Antiga/.test(f.file));
  assert.equal(all.length, 1);
});
