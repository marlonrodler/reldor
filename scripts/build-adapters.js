#!/usr/bin/env node
'use strict';

/**
 * Builds the IDE plugins from one source:
 *   skills/*                 -> every plugin
 *   modules/<mod>/advisors/* -> every plugin
 *   adapters/<ide>/plugin.json + version from package.json
 * Output: dist/<ide>/reldor/
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const pkg = require(path.join(ROOT, 'package.json'));

const TARGETS = {
  claude: { manifestDir: '.claude-plugin' },
  kiro: { manifestDir: '.' },
};

function skillSources() {
  const sources = [];
  const add = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const folder = path.join(dir, entry.name);
      if (entry.isDirectory() && fs.existsSync(path.join(folder, 'SKILL.md'))) sources.push(folder);
    }
  };
  add(path.join(ROOT, 'skills'));
  const modulesDir = path.join(ROOT, 'modules');
  for (const mod of fs.readdirSync(modulesDir)) add(path.join(modulesDir, mod, 'advisors'));
  return sources;
}

function build(target) {
  const { manifestDir } = TARGETS[target];
  const out = path.join(DIST, target, 'reldor');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, manifestDir), { recursive: true });

  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'adapters', target, 'plugin.json'), 'utf8'));
  manifest.version = pkg.version;
  fs.writeFileSync(path.join(out, manifestDir, 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n');

  const skills = skillSources();
  for (const src of skills) {
    const name = path.basename(src) === 'reldor' ? 'reldor' : `reldor-${path.basename(src)}`;
    fs.cpSync(src, path.join(out, 'skills', name), { recursive: true });
  }
  return { out, skills: skills.length };
}

if (require.main === module) {
  for (const target of Object.keys(TARGETS)) {
    const { out, skills } = build(target);
    process.stdout.write(`✅ ${target}: ${skills} skill(s) em ${path.relative(ROOT, out)}\n`);
  }
}

module.exports = { build, skillSources };
