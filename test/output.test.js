'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { saveOutput, clearOutput, dirOf } = require('../core/output');
const { main } = require('../core/cli/index');

const project = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-output-'));
  fs.writeFileSync(path.join(dir, 'sfdx-project.json'), '{"packageDirectories":[{"path":"force-app","default":true}]}');
  return dir;
};

test('every command answer is saved in .reldor/work/output, one file per command', async () => {
  const dir = project();
  const write = process.stdout.write;
  process.stdout.write = () => true;
  try {
    await main(['output', '--cwd', dir]); // output itself is not saved
    await main(['me', '--json', '--cwd', dir]);
  } finally {
    process.stdout.write = write;
  }
  const files = fs.readdirSync(dirOf(dir));
  assert.ok(files.includes('me.json'));
  assert.ok(!files.some((f) => f.startsWith('output.')));
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dirOf(dir), 'me.json'), 'utf8')).team, null);
});

test('outputs go away when the task changes, when old, and on --clear', () => {
  const dir = project();
  saveOutput(dir, 'status', 'a');
  const state = path.join(dirOf(dir), '.state.json');
  fs.writeFileSync(state, JSON.stringify({ task: 'OTHER-1', phase: 'refinar' }));
  saveOutput(dir, 'review', 'b');
  assert.deepStrictEqual(fs.readdirSync(dirOf(dir)).filter((f) => f !== '.state.json'), ['review.txt']);
  const old = path.join(dirOf(dir), 'review.txt');
  const past = new Date(Date.now() - 8 * 24 * 3600 * 1000);
  fs.utimesSync(old, past, past);
  saveOutput(dir, 'usages', 'c');
  assert.ok(!fs.existsSync(old));
  assert.strictEqual(clearOutput(dir), 1);
  assert.strictEqual(saveOutput(dir, 'help', 'x'), null);
  assert.strictEqual(saveOutput(os.tmpdir(), 'status', 'x'), null);
});
