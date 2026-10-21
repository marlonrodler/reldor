#!/usr/bin/env node
'use strict';

/**
 * Builds the IDE plugins from one source:
 *   skills/*                 -> every plugin
 *   modules/<mod>/advisors/* -> every plugin
 *   .claude-plugin/plugin.json (Claude Code) or adapters/kiro/plugin.json + version from package.json
 * Output: dist/<ide>/reldor/, and plugins/kiro/reldor/ (committed, so Kiro installs straight from the GitHub link).
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const pkg = require(path.join(ROOT, 'package.json'));
const KIRO_COMMITTED = path.join(ROOT, 'plugins', 'kiro', 'reldor');

const TARGETS = {
  claude: { manifestDir: '.claude-plugin', source: path.join(ROOT, '.claude-plugin', 'plugin.json') },
  kiro: { manifestDir: '.', source: path.join(ROOT, 'adapters', 'kiro', 'plugin.json') },
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

/** Builds one IDE plugin into `out` (default dist/<ide>/reldor). */
function build(target, out = path.join(DIST, target, 'reldor')) {
  const { manifestDir, source } = TARGETS[target];
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, manifestDir), { recursive: true });

  const manifest = JSON.parse(fs.readFileSync(source, 'utf8'));
  delete manifest.skills; // the built plugin copies every skill into skills/
  manifest.version = pkg.version;
  fs.writeFileSync(path.join(out, manifestDir, 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n');

  const skills = skillSources();
  for (const src of skills) {
    const name = path.basename(src) === 'reldor' ? 'reldor' : `reldor-${path.basename(src)}`;
    fs.cpSync(src, path.join(out, 'skills', name), { recursive: true });
  }
  if (target === 'kiro') kiroLegacyPower(out, manifest, skills);
  return { out, skills: skills.length };
}

/** Body of a SKILL.md, without its frontmatter. */
function skillBody(file) {
  return fs.readFileSync(file, 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
}

/**
 * Kiro versions that predate the Agent Plugins format activate a power only through POWER.md (with steering files
 * next to it). The same plugin ships both: newer Kiro reads plugin.json + skills/, older Kiro reads POWER.md + steering/.
 * Everything is generated from the same skills, so the two never drift.
 */
function kiroLegacyPower(out, manifest, skills) {
  const steering = path.join(out, 'steering');
  fs.mkdirSync(steering, { recursive: true });
  const files = [];
  for (const src of skills) {
    const base = path.basename(src);
    if (base === 'reldor') {
      fs.writeFileSync(path.join(steering, 'reldor-guide.md'), fs.readFileSync(path.join(src, 'guide.md'), 'utf8'));
      files.push({ file: 'reldor-guide.md', when: 'para escolher o comando a partir do que a pessoa pede' });
      continue;
    }
    const name = `reldor-${base}.md`;
    const desc = (fs.readFileSync(path.join(src, 'SKILL.md'), 'utf8').match(/^description:\s*(.+)$/m) || [])[1] || '';
    fs.writeFileSync(path.join(steering, name), `${skillBody(path.join(src, 'SKILL.md'))}\n`);
    files.push({ file: name, when: desc.trim() });
  }
  const router = skillBody(path.join(ROOT, 'skills', 'reldor', 'SKILL.md'))
    .replace(/Leia `guide\.md`/g, 'Leia o steering `reldor-guide.md`')
    .replace(/o conselheiro (reldor-[a-z-]+)/g, 'o conselheiro $1 (steering `$1.md`)');
  const q = (v) => JSON.stringify(v);
  const text = [
    '---',
    `name: ${q(manifest.name)}`,
    `displayName: ${q('Reldor')}`,
    `description: ${q(manifest.description)}`,
    `keywords: ${q(manifest.keywords || [])}`,
    `author: ${q((manifest.author && manifest.author.name) || '')}`,
    '---',
    '',
    '# Onboarding',
    '',
    '## Step 1: Validar o comando reldor',
    'Rode `reldor --version` no terminal do projeto.',
    '- Se o comando não for reconhecido, o Reldor não está instalado neste computador (ou a pasta do npm não está no PATH).',
    '  Explique à pessoa e, com a confirmação dela, rode `npm install -g github:marlonrodler/reldor`.',
    '- Se o PowerShell disser que a execução de scripts está desabilitada, ou estiver em modo de linguagem restrito, use',
    '  `reldor.cmd` no lugar de `reldor` (ou o caminho completo que `npm prefix -g` mostra, mais `\\reldor.cmd`).',
    '  Não tente mudar a política do PowerShell: é decisão da TI.',
    '',
    '## Step 2: Conferir a pasta',
    'Rode `reldor doctor --json` e siga o `next`.',
    '',
    '# Arquivos de steering deste power',
    '',
    ...files.map((f) => `- \`${f.file}\`: ${f.when}`),
    '',
    router,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(out, 'POWER.md'), text);
}

if (require.main === module) {
  for (const target of Object.keys(TARGETS)) {
    const { out, skills } = build(target);
    process.stdout.write(`✅ ${target}: ${skills} skill(s) em ${path.relative(ROOT, out)}\n`);
  }
  const { out } = build('kiro', KIRO_COMMITTED);
  process.stdout.write(`✅ kiro (para o link do GitHub): ${path.relative(ROOT, out)}\n`);
}

module.exports = { build, skillSources, KIRO_COMMITTED };
