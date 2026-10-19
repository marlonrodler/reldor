'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { skillSources, build, KIRO_COMMITTED } = require('../scripts/build-adapters');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('the Claude Code plugin ships every skill, and versions match', () => {
  const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
  const expected = skillSources().map((dir) => `./${path.relative(ROOT, dir).split(path.sep).join('/')}`).sort();
  assert.deepEqual([...plugin.skills].sort(), expected);
  assert.equal(plugin.version, JSON.parse(read('package.json')).version);
});

test('both READMEs link every skill', () => {
  for (const readme of ['README.md', 'README.pt-BR.md']) {
    const text = read(readme);
    for (const dir of skillSources()) {
      const rel = `./${path.relative(ROOT, dir).split(path.sep).join('/')}/SKILL.md`;
      assert.ok(text.includes(rel), `${readme} does not link ${rel}`);
    }
  }
});

test('every docs page exists in both languages, with the language switcher', () => {
  const pages = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== 'adr') walk(full);
      else if (e.name.endsWith('.md')) pages.push(full);
    }
  };
  walk(path.join(ROOT, 'docs'));
  for (const page of pages.filter((p) => !p.endsWith('.pt-BR.md'))) {
    const pt = page.replace(/\.md$/, '.pt-BR.md');
    assert.ok(fs.existsSync(pt), `missing ${path.relative(ROOT, pt)}`);
    assert.match(fs.readFileSync(page, 'utf8'), /<strong>English<\/strong>/);
    assert.match(fs.readFileSync(pt, 'utf8'), /<strong>Português<\/strong>/);
  }
});

// Every file under a folder, as relative path -> text with Windows line endings flattened.
function tree(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else out[path.relative(dir, full).split(path.sep).join('/')] = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
    }
  };
  walk(dir);
  return out;
}

test('the Kiro plugin in plugins/kiro/reldor is up to date (run npm run build:adapters)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-kiro-'));
  try {
    build('kiro', path.join(tmp, 'reldor'));
    assert.deepEqual(tree(KIRO_COMMITTED), tree(path.join(tmp, 'reldor')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
