'use strict';

/**
 * What the Salesforce module can do (its capabilities), and the signs that another tool of the team already does it.
 * Detection only reads files of the project (hooks, pipelines, AI instructions, package.json, .gitattributes) and
 * suggests an entry for tools: in the config. It never changes anything.
 */
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('../../core/util/exec');

/**
 * kind: fixer (changes files), check (only reads), action (does something outside the files).
 * modes: what a project may choose. A fixer can be verified; an action can only be run or skipped.
 */
const CAPABILITIES = [
  { id: 'xml-duplicates', label: 'XML sem entradas duplicadas (profiles, permission sets, labels...)', kind: 'fixer', modes: ['run', 'verify', 'skip'], where: ['xml', 'review', 'gancho pre-commit'] },
  { id: 'xml-order', label: 'XML em ordem (profiles, permission sets, labels...)', kind: 'fixer', modes: ['run', 'verify', 'skip'], where: ['xml', 'review'] },
  { id: 'org-files', label: 'Arquivos que só vieram da org fora do commit', kind: 'check', modes: ['run', 'verify', 'skip'], where: ['review', 'gancho pre-commit'] },
  { id: 'security', label: 'Regras de segurança do Reldor', kind: 'check', modes: ['run', 'verify', 'skip'], where: ['security', 'review'] },
  { id: 'quality', label: 'Código repetido (regras do Reldor)', kind: 'check', modes: ['run', 'verify', 'skip'], where: ['quality', 'review'] },
  { id: 'code-analyzer', label: 'Salesforce Code Analyzer (PMD, CPD e regras de segurança)', kind: 'check', modes: ['run', 'skip'], where: ['security', 'quality', 'review'] },
  { id: 'queries', label: 'Campo lido fora da query', kind: 'check', modes: ['run', 'verify', 'skip'], where: ['check', 'test-radar', 'review'] },
  { id: 'affected-tests', label: 'Lista de testes que a mudança pode quebrar', kind: 'check', modes: ['run', 'verify', 'skip'], where: ['test-radar', 'review'] },
  { id: 'run-tests', label: 'Rodar os testes na sandbox', kind: 'action', modes: ['run', 'skip'], where: ['test-radar --run'] },
  { id: 'pre-commit', label: 'Gancho pre-commit do Reldor', kind: 'action', modes: ['run', 'skip'], where: ['hook install'] },
  { id: 'profile-merge', label: 'Merge de profile e permission set item a item', kind: 'action', modes: ['run', 'skip'], where: ['merge install'] },
];

const XML_WORDS = /(profile|permission ?set|permissionset|labels?|\.xml|xml)/i;
/** Keyword rules: capability, what must appear, and the mode to suggest. */
const RULES = [
  { capability: 'xml-duplicates', key: /(duplicad|duplicate|dedup|remove[- ]?dup)/i, also: XML_WORDS, suggested: 'verify' },
  { capability: 'xml-order', key: /(\bsort|ordena|ordem alfab)/i, also: XML_WORDS, suggested: 'verify' },
  { capability: 'code-analyzer', key: /(code-analyzer|scanner:run|sfdx scanner|sf scanner|\bpmd\b)/i, suggested: 'skip' },
  { capability: 'run-tests', key: /(apex run test|apex:test:run|force:apex:test|RunLocalTests|RunSpecifiedTests|test-level|testlevel)/i, suggested: 'skip' },
  { capability: 'security', key: /(checkmarx|veracode|fortify|snyk code|security scan)/i, suggested: 'verify' },
  { capability: 'quality', key: /(sonar|copy[- ]?paste detector|duplicated code)/i, suggested: 'verify' },
];

/** Reads a text file, or '' when it cannot. */
function read(file) {
  try {
    return fs.statSync(file).size < 512 * 1024 ? fs.readFileSync(file, 'utf8') : '';
  } catch {
    return '';
  }
}

/** Files under a folder (up to `depth` levels) whose name matches. */
function files(dir, test, depth = 4, out = []) {
  if (depth < 0) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.git') files(full, test, depth - 1, out);
    } else if (test(e.name)) out.push(full);
  }
  return out;
}

/** Where other tools leave traces, grouped by the kind of owner they describe. */
function sources(root) {
  const at = (...p) => path.join(root, ...p);
  const list = [];
  const add = (owner, file) => list.push({ owner, file });
  // Git hooks and hook managers.
  const hooksPath = run('git', ['config', 'core.hooksPath'], { cwd: root, timeout: 10000 }).stdout;
  if (hooksPath) for (const f of files(path.resolve(root, hooksPath), () => true, 1)) add('gancho de Git do time', f);
  for (const f of files(at('.husky'), (n) => !n.startsWith('.'), 1)) add('gancho de Git do time (husky)', f);
  for (const f of ['lefthook.yml', 'lefthook.yaml', '.pre-commit-config.yaml', '.lintstagedrc', '.lintstagedrc.json', '.lintstagedrc.yml']) if (fs.existsSync(at(f))) add('gancho de Git do time', at(f));
  const preCommit = at('.git', 'hooks', 'pre-commit');
  if (fs.existsSync(preCommit) && !read(preCommit).includes('# reldor-guard')) add('gancho de Git do time', preCommit);
  if (fs.existsSync(at('.git', 'hooks', 'pre-commit.reldor-prev'))) add('gancho de Git do time', at('.git', 'hooks', 'pre-commit.reldor-prev'));
  // Pipelines.
  for (const f of files(at('.github', 'workflows'), (n) => /\.ya?ml$/i.test(n), 1)) add('esteira (CI)', f);
  for (const f of ['azure-pipelines.yml', 'azure-pipelines.yaml', '.gitlab-ci.yml', 'bitbucket-pipelines.yml', 'Jenkinsfile', path.join('.circleci', 'config.yml')]) if (fs.existsSync(at(f))) add('esteira (CI)', at(f));
  // AI instructions and plugins kept in the project.
  for (const f of files(at('.kiro'), (n) => /\.(md|json|ya?ml)$/i.test(n), 4)) if (!/[\\/]specs[\\/]/.test(f)) add('instruções da IA (Kiro)', f);
  for (const f of files(at('.claude'), (n) => /\.md$/i.test(n), 4)) add('instruções da IA (Claude)', f);
  for (const f of files(at('.cursor'), (n) => /\.(md|mdc)$/i.test(n), 3)) add('instruções da IA (Cursor)', f);
  for (const f of ['AGENTS.md', 'CLAUDE.md', path.join('.github', 'copilot-instructions.md')]) if (fs.existsSync(at(f))) add('instruções da IA', at(f));
  // npm scripts of the project.
  if (fs.existsSync(at('package.json'))) add('scripts do package.json', at('package.json'));
  return list;
}

/**
 * The lines that show a rule: the line has the rule's key word, and the other words it needs (`also`) are on the same
 * line or within the two lines around it ("remove duplicates" here, "profiles" on the next line still counts).
 */
function evidenceLines(text, rule) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length && out.length < 2; i += 1) {
    if (!rule.key.test(lines[i])) continue;
    if (rule.also && !rule.also.test(lines.slice(Math.max(0, i - 2), i + 3).join(' '))) continue;
    out.push({ line: i + 1, text: lines[i].trim().slice(0, 120) });
  }
  return out;
}

/** Signs that another tool already does what Reldor can do. */
function detectTools(root) {
  const found = [];
  for (const src of sources(root)) {
    const text = read(src.file);
    if (!text) continue;
    const rel = path.relative(root, src.file).split(path.sep).join('/');
    for (const rule of RULES) {
      const lines = evidenceLines(text, rule);
      if (!lines.length) continue;
      found.push({ capability: rule.capability, owner: `${src.owner}: ${rel}`, suggested: rule.suggested, evidence: lines.map((l) => `${rel}:${l.line}: ${l.text}`) });
    }
  }
  // A merge driver already set for profiles in .gitattributes (versioned by the team).
  const attrs = read(path.join(root, '.gitattributes'));
  const driver = attrs.split(/\r?\n/).map((l, i) => ({ l, i })).find(({ l }) => /(profile|permissionset)[^\s]*\s.*merge=(?!reldor)/i.test(l));
  if (driver) found.push({ capability: 'profile-merge', owner: 'merge driver do time: .gitattributes', suggested: 'skip', evidence: [`.gitattributes:${driver.i + 1}: ${driver.l.trim()}`] });
  return found;
}

module.exports = { CAPABILITIES, detectTools, RULES };
