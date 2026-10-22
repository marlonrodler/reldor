'use strict';

/**
 * reldor setup [--yes] [--no-install] [--json]
 * One command after reading the README (npx github:marlonrodler/reldor setup): installs the Reldor for this user
 * (npm install -g, no admin), registers it as an MCP server in Kiro (the AI calls it without a terminal) and, on
 * Windows, puts the npm folder in the PATH of Kiro's terminals only (Kiro's own settings: no system variable, no IT).
 * Shows what will change, asks once, keeps a backup of every file it touches. Safe to run again.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, IS_WINDOWS } = require('../util/exec');
const { confirm } = require('./confirm');
const { print, printJson } = require('../report');

const SOURCE = 'github:marlonrodler/reldor';
const SELF = path.resolve(__dirname, '..', '..');

/** JSON with comments (VS Code style settings) → object; null when it cannot be read safely. */
function readJsonc(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(text);
  } catch {
    try {
      // Comments and trailing commas outside strings.
      const clean = text.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => str || '').replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(clean || '{}');
    } catch {
      return null;
    }
  }
}

/** Writes JSON, keeping the previous file as <file>.reldor-backup. */
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.reldor-backup`);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

/** Where things are: npm's global folders, the Kiro files, and whether this copy is the installed one. */
function locate(flags) {
  const home = typeof flags.home === 'string' ? flags.home : os.homedir();
  const appdata = typeof flags.appdata === 'string' ? flags.appdata : process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const npmRoot = process.env.RELDOR_NPM_ROOT || run('npm', ['root', '-g']).stdout;
  const npmPrefix = process.env.RELDOR_NPM_PREFIX || run('npm', ['prefix', '-g']).stdout;
  const installed = npmRoot ? path.join(npmRoot, 'reldor') : null;
  const isInstalledCopy = Boolean(installed) && path.resolve(installed) === SELF;
  return {
    home,
    npmRoot,
    npmPrefix,
    installed,
    hasInstall: Boolean(installed) && fs.existsSync(path.join(installed, 'core', 'mcp', 'server.js')),
    isInstalledCopy,
    mcpFile: path.join(home, '.kiro', 'settings', 'mcp.json'),
    kiroSettings: path.join(appdata, 'Kiro', 'User', 'settings.json'),
    windows: IS_WINDOWS || typeof flags.appdata === 'string',
  };
}

async function setupCommand(root, flags) {
  const where = locate(flags);
  const steps = [];
  const notes = [];

  // 1. The installed copy (what the MCP server and the terminal will run).
  const needInstall = !flags['no-install'] && !where.isInstalledCopy;
  if (needInstall) steps.push({ id: 'install', text: `Instalar (ou atualizar) o Reldor para o seu usuário: npm install -g ${SOURCE}` });
  const serverPath = where.isInstalledCopy || !needInstall ? path.join(SELF, 'core', 'mcp', 'server.js') : path.join(where.installed || SELF, 'core', 'mcp', 'server.js');

  // 2. Kiro MCP: the AI calls the Reldor without a terminal.
  const mcp = readJsonc(where.mcpFile);
  const entry = { command: process.execPath, args: [serverPath], disabled: false, autoApprove: ['reldor_ler'] };
  if (mcp === null) notes.push(`Não consegui ler ${where.mcpFile} (JSON inválido). Acrescente à mão em "mcpServers": "reldor": ${JSON.stringify(entry)}`);
  else if (JSON.stringify((mcp.mcpServers || {}).reldor) !== JSON.stringify(entry)) steps.push({ id: 'mcp', text: `Registrar o Reldor como servidor MCP do Kiro (${where.mcpFile}); as leituras rodam sem pedir aprovação` });

  // 3. Windows: the npm folder in the PATH of Kiro's terminals only.
  let settings = null;
  const pathParts = (process.env.PATH || '').split(path.delimiter).map((p) => p.toLowerCase().replace(/[\\/]+$/, ''));
  const npmInPath = where.npmPrefix && pathParts.includes(where.npmPrefix.toLowerCase().replace(/[\\/]+$/, ''));
  if (where.windows && where.npmPrefix && (!npmInPath || flags['force-path'])) {
    settings = readJsonc(where.kiroSettings);
    if (settings === null) notes.push(`Não consegui ler ${where.kiroSettings}. Acrescente à mão: "terminal.integrated.env.windows": { "PATH": "\${env:PATH};${where.npmPrefix}" }`);
    else if (!String(((settings['terminal.integrated.env.windows'] || {}).PATH) || '').includes(where.npmPrefix)) steps.push({ id: 'path', text: `Pôr ${where.npmPrefix} no PATH só dos terminais do Kiro (${where.kiroSettings}), sem mexer nas variáveis do Windows` });
  }

  const out = ['\n🛡️  Reldor · instalação', ''];
  if (!steps.length) {
    if (flags.json) printJson({ done: [], notes, ok: true });
    else print([...out, '✅ Já está tudo pronto.', ...notes.map((n) => `⚠️ ${n}`), '', '➡️  No Kiro, num chat novo: "quero usar o Reldor".']);
    return 0;
  }
  out.push('Vou fazer:', ...steps.map((s, i) => `   ${i + 1}. ${s.text}`), '', 'Cada arquivo do Kiro que eu mudar fica com uma cópia .reldor-backup.');
  if (!flags.json) print(out);
  if (!(await confirm('\n🛡️ Posso fazer isso?', flags))) {
    if (flags.json) printJson({ done: [], planned: steps.map((s) => s.id), notes });
    else print('Nada foi alterado.');
    return 0;
  }

  const done = [];
  for (const s of steps) {
    if (s.id === 'install') {
      const r = run('npm', ['install', '-g', SOURCE], { timeout: 10 * 60 * 1000 });
      if (!r.ok) {
        print([`❌ O npm install falhou: ${(r.stderr || r.stdout).split('\n').slice(-3).join(' ')}`, '   Nada mais foi alterado. Veja o "Deu problema?" do README.']);
        return 1;
      }
      done.push('install');
    } else if (s.id === 'mcp') {
      writeJson(where.mcpFile, { ...mcp, mcpServers: { ...(mcp.mcpServers || {}), reldor: entry } });
      done.push('mcp');
    } else if (s.id === 'path') {
      const env = { ...(settings['terminal.integrated.env.windows'] || {}) };
      env.PATH = `${env.PATH || '${env:PATH}'};${where.npmPrefix}`;
      writeJson(where.kiroSettings, { ...settings, 'terminal.integrated.env.windows': env });
      done.push('path');
    }
  }
  if (flags.json) {
    printJson({ done, notes, mcpFile: where.mcpFile, server: serverPath });
    return 0;
  }
  print([
    '',
    `✅ Pronto (${done.length} passo(s)).`,
    ...notes.map((n) => `⚠️ ${n}`),
    '',
    '➡️  Feche e abra o Kiro (ou "Developer: Reload Window").',
    '➡️  Se ainda não tem o power do Reldor no Kiro, importe pelo link do README (é o que ensina a IA a usar o Reldor).',
    '➡️  Num chat novo: "quero usar o Reldor".',
  ]);
  return 0;
}

module.exports = { setupCommand, readJsonc };
