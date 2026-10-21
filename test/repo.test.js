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
  for (const readme of ['README.md', 'README.en.md']) {
    const text = read(readme);
    for (const dir of skillSources()) {
      const rel = `./${path.relative(ROOT, dir).split(path.sep).join('/')}/SKILL.md`;
      assert.ok(text.includes(rel), `${readme} does not link ${rel}`);
    }
  }
});

// Every document of the repository: Markdown outside code folders, except the AI's own instructions.
function documents() {
  const SKIP = new Set(['node_modules', '.git', 'dist', 'plugins', 'fixtures', 'skills', 'modules', '.claude-plugin']);
  const KEEP_ONE = new Set(['CLAUDE.md']);
  const pages = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP.has(e.name)) walk(full);
      } else if (e.name.endsWith('.md') && !KEEP_ONE.has(e.name)) pages.push(full);
    }
  };
  walk(ROOT);
  return pages;
}

test('every document has a Portuguese version (<name>.md) and an English one (<name>.en.md), Portuguese first', () => {
  const pages = documents();
  assert.ok(pages.length > 40);
  for (const page of pages) {
    const rel = path.relative(ROOT, page);
    const isEn = page.endsWith('.en.md');
    const other = isEn ? page.replace(/\.en\.md$/, '.md') : page.replace(/\.md$/, '.en.md');
    assert.ok(fs.existsSync(other), `${rel} has no ${isEn ? 'Portuguese' : 'English'} version`);
    const first = fs.readFileSync(page, 'utf8').split(/\r?\n/)[0];
    assert.match(first, isEn ? /^<p align="center"><a href="[^"]+">Português<\/a> · <strong>English<\/strong><\/p>$/ : /^<p align="center"><strong>Português<\/strong> · <a href="[^"]+">English<\/a><\/p>$/, `${rel}: language switcher`);
  }
});

test('relative links between documents point to files that exist', () => {
  for (const page of documents()) {
    const text = fs.readFileSync(page, 'utf8');
    for (const m of text.matchAll(/\]\((?!https?:|#|mailto:)([^)\s#]+)(#[^)\s]*)?\)/g)) {
      const target = path.resolve(path.dirname(page), m[1]);
      assert.ok(fs.existsSync(target), `${path.relative(ROOT, page)} links to ${m[1]}, which does not exist`);
    }
    for (const m of text.matchAll(/href="(?!https?:)([^"#]+)"/g)) {
      assert.ok(fs.existsSync(path.resolve(path.dirname(page), m[1])), `${path.relative(ROOT, page)} links to ${m[1]}`);
    }
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

test('the Kiro plugin also has POWER.md and steering files, for Kiro versions that need the older format', () => {
  const power = fs.readFileSync(path.join(KIRO_COMMITTED, 'POWER.md'), 'utf8');
  assert.match(power, /^---\nname: "reldor"\ndisplayName: "Reldor"\ndescription: ".+"\nkeywords: \[.+\]\nauthor: ".+"\n---\n/);
  assert.match(power, /# Onboarding/);
  assert.match(power, /reldor status --json/, 'the router instructions are inside');
  for (const f of ['reldor-guide.md', 'reldor-task-refine.md', 'reldor-lwc-ux.md', 'reldor-automation-design.md']) {
    assert.ok(fs.existsSync(path.join(KIRO_COMMITTED, 'steering', f)), f);
    assert.ok(power.includes(f), `POWER.md lists ${f}`);
  }
  assert.ok(!/^---/.test(fs.readFileSync(path.join(KIRO_COMMITTED, 'steering', 'reldor-task-refine.md'), 'utf8')), 'steering files carry no skill frontmatter');
});
