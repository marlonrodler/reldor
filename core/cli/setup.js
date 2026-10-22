'use strict';

/**
 * reldor setup [--yes] [--undo] [--no-install] [--json]
 * One command after reading the README (npx github:marlonrodler/reldor setup). It only adds the Reldor, and asks about
 * each change separately: install it for this user (npm install -g, no admin), register it as an MCP server in the AI
 * tools found on this machine (Kiro, Claude Code) and, on Windows, put the npm folder in the PATH of Kiro's terminals
 * only. It never changes the terminal nor the IDE's permissions: the IDE keeps asking before running a command.
 * Every file it touches keeps a .reldor-backup copy; what it did is written in ~/.reldor/setup.json.
 * --undo removes exactly what the setup added (also what versions up to 0.25 added: Git Bash and the "reldor *" rule).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline/promises');
const { run, IS_WINDOWS } = require('../util/exec');
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

const backedUp = new Set();
/** Writes a file, keeping it as it was before this run as <file>.reldor-backup. */
function writeKeeping(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && !backedUp.has(file)) fs.copyFileSync(file, `${file}.reldor-backup`);
  backedUp.add(file);
  fs.writeFileSync(file, text);
}
const writeJson = (file, data) => writeKeeping(file, `${JSON.stringify(data, null, 2)}\n`);

/** Where things are: npm's global folders, the AI tools of this machine, and whether this copy is the installed one. */
function locate(flags) {
  const home = typeof flags.home === 'string' ? flags.home : os.homedir();
  const appdata = typeof flags.appdata === 'string' ? flags.appdata : process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const npmRoot = process.env.RELDOR_NPM_ROOT || run('npm', ['root', '-g']).stdout;
  const npmPrefix = process.env.RELDOR_NPM_PREFIX || run('npm', ['prefix', '-g']).stdout;
  const installed = npmRoot ? path.join(npmRoot, 'reldor') : null;
  const kiroSettings = path.join(appdata, 'Kiro', 'User', 'settings.json');
  const claudeBin = process.env.RELDOR_CLAUDE_BIN || 'claude';
  return {
    home,
    npmPrefix,
    installed,
    isInstalledCopy: Boolean(installed) && path.resolve(installed) === SELF,
    kiro: fs.existsSync(path.join(home, '.kiro')) || fs.existsSync(path.dirname(kiroSettings)),
    mcpFile: path.join(home, '.kiro', 'settings', 'mcp.json'),
    permissionsFile: path.join(home, '.kiro', 'settings', 'permissions.yaml'),
    kiroSettings,
    claudeBin,
    claude: run(claudeBin, ['--version'], { timeout: 15000 }).ok,
    manifest: path.join(home, '.reldor', 'setup.json'),
    windows: IS_WINDOWS || typeof flags.appdata === 'string',
  };
}

/** Asks one yes/no question; --yes answers yes. Without a terminal and without --yes, the caller only shows the plan. */
async function ask(rl, question, flags) {
  if (flags.yes) return true;
  return /^s/i.test((await rl.question(`${question} (s/n): `)).trim());
}

const samePath = (a, b) => String(a || '').toLowerCase().replace(/[\\/]+$/, '') === String(b || '').toLowerCase().replace(/[\\/]+$/, '');

/** Changes the setup can make now: one entry per question. */
function planInstall(where, flags) {
  const steps = [];
  const needInstall = !flags['no-install'] && !where.isInstalledCopy;
  const serverPath = path.join(needInstall ? where.installed || SELF : SELF, 'core', 'mcp', 'server.js');
  if (needInstall) steps.push({ id: 'install', text: `Instalar (ou atualizar) o Reldor para o seu usuário: npm install -g ${SOURCE}` });
  const entry = { command: process.execPath, args: [serverPath], disabled: false };
  const notes = [];

  if (where.kiro) {
    const mcp = readJsonc(where.mcpFile);
    if (mcp === null) notes.push(`Não consegui ler ${where.mcpFile} (JSON inválido). Acrescente à mão em "mcpServers": "reldor": ${JSON.stringify(entry)}`);
    else {
      const now = (mcp.mcpServers || {}).reldor;
      // 0.25 auto-approved the reads; now the IDE asks, so that one setting goes.
      const oldAuto = now && JSON.stringify(now.autoApprove) === '["reldor_read"]';
      if (!now || oldAuto || now.command !== entry.command || JSON.stringify(now.args) !== JSON.stringify(entry.args)) {
        const next = { ...(now || {}), ...entry };
        if (oldAuto) delete next.autoApprove;
        steps.push({ id: 'kiro-mcp', text: `Registrar o Reldor como servidor MCP no Kiro (${where.mcpFile}). O Kiro continua pedindo aprovação antes de cada uso.`, apply: () => writeJson(where.mcpFile, { ...mcp, mcpServers: { ...(mcp.mcpServers || {}), reldor: next } }) });
      }
    }
    // Windows: the npm folder in the PATH of Kiro's terminals only (no system variable).
    const inPath = (process.env.PATH || '').split(path.delimiter).some((p) => samePath(p, where.npmPrefix));
    if (where.windows && where.npmPrefix && (!inPath || flags['force-path'])) {
      const settings = readJsonc(where.kiroSettings);
      if (settings === null) notes.push(`Não consegui ler ${where.kiroSettings}. Acrescente à mão: "terminal.integrated.env.windows": { "PATH": "\${env:PATH};${where.npmPrefix}" }`);
      else if (!String((settings['terminal.integrated.env.windows'] || {}).PATH || '').includes(where.npmPrefix)) {
        steps.push({
          id: 'kiro-path',
          text: `Pôr ${where.npmPrefix} no PATH só dos terminais do Kiro (${where.kiroSettings}), sem mexer nas variáveis do Windows`,
          apply: () => {
            const env = { ...(settings['terminal.integrated.env.windows'] || {}) };
            env.PATH = `${env.PATH || '${env:PATH}'};${where.npmPrefix}`;
            writeJson(where.kiroSettings, { ...settings, 'terminal.integrated.env.windows': env });
          },
        });
      }
    }
  }

  if (where.claude && !run(where.claudeBin, ['mcp', 'get', 'reldor'], { timeout: 15000 }).ok) {
    steps.push({
      id: 'claude-mcp',
      text: 'Registrar o Reldor como servidor MCP no Claude Code (claude mcp add --scope user). Ele continua pedindo aprovação.',
      apply: () => {
        const r = run(where.claudeBin, ['mcp', 'add', '--scope', 'user', 'reldor', '--', process.execPath, serverPath], { timeout: 30000 });
        if (!r.ok) throw new Error(`claude mcp add falhou: ${(r.stderr || r.stdout).trim().split('\n').pop()}`);
      },
    });
  }
  if (!where.kiro && !where.claude) notes.push('Não achei o Kiro nem o Claude Code nesta máquina: o Reldor fica só no terminal (comando reldor).');
  return { steps, notes, serverPath };
}

/** What --undo can remove: what the setup added now, and what older versions added (Git Bash, the "reldor *" rule). */
function planUndo(where) {
  const steps = [];
  const notes = [];
  const mcp = readJsonc(where.mcpFile);
  if (mcp && mcp.mcpServers && mcp.mcpServers.reldor) {
    steps.push({ id: 'kiro-mcp', text: `Tirar o servidor MCP "reldor" do Kiro (${where.mcpFile})`, apply: () => {
      const servers = { ...mcp.mcpServers };
      delete servers.reldor;
      writeJson(where.mcpFile, { ...mcp, mcpServers: servers });
    } });
  }
  let settings = readJsonc(where.kiroSettings);
  if (settings === null) notes.push(`Não consegui ler ${where.kiroSettings}: confira à mão o PATH e o terminal padrão.`);
  settings = settings || {};
  const env = settings['terminal.integrated.env.windows'] || {};
  const prefix = where.npmPrefix;
  if (prefix && String(env.PATH || '').includes(prefix)) {
    steps.push({ id: 'kiro-path', text: `Tirar ${prefix} do PATH dos terminais do Kiro (${where.kiroSettings})`, apply: () => {
      const next = { ...env };
      const rest = String(env.PATH).split(';').filter((p) => !samePath(p, prefix));
      if (!rest.length || (rest.length === 1 && rest[0] === '${env:PATH}')) delete next.PATH;
      else next.PATH = rest.join(';');
      settings = { ...settings, 'terminal.integrated.env.windows': next };
      if (!Object.keys(next).length) delete settings['terminal.integrated.env.windows'];
      writeJson(where.kiroSettings, settings);
    } });
  }
  if (settings['terminal.integrated.defaultProfile.windows'] === 'Git Bash') {
    steps.push({ id: 'kiro-terminal', text: 'Deixar de usar o Git Bash como terminal padrão do Kiro (o Reldor 0.25 colocou; se foi você que escolheu, responda não)', apply: () => {
      const next = { ...settings };
      delete next['terminal.integrated.defaultProfile.windows'];
      const profiles = { ...(next['terminal.integrated.profiles.windows'] || {}) };
      if (profiles['Git Bash'] && Object.keys(profiles['Git Bash']).join() === 'path') delete profiles['Git Bash'];
      if (Object.keys(profiles).length) next['terminal.integrated.profiles.windows'] = profiles;
      else delete next['terminal.integrated.profiles.windows'];
      settings = next;
      writeJson(where.kiroSettings, settings);
    } });
  }
  if (fs.existsSync(where.permissionsFile)) {
    const YAML = require('yaml');
    let data = null;
    try {
      data = YAML.parse(fs.readFileSync(where.permissionsFile, 'utf8')) || {};
    } catch {
      notes.push(`Não consegui ler ${where.permissionsFile}: se houver a regra "reldor *", tire à mão.`);
    }
    const isOurs = (r) => r && r.capability === 'shell' && (r.match || []).includes('reldor *');
    if (data && Array.isArray(data.rules) && data.rules.some(isOurs)) {
      steps.push({ id: 'kiro-permissions', text: `Tirar a liberação automática dos comandos "reldor ..." do Kiro (${where.permissionsFile}); ele volta a pedir aprovação`, apply: () => writeKeeping(where.permissionsFile, YAML.stringify({ ...data, rules: data.rules.filter((r) => !isOurs(r)) })) });
    }
  }
  if (where.claude && run(where.claudeBin, ['mcp', 'get', 'reldor'], { timeout: 15000 }).ok) {
    steps.push({ id: 'claude-mcp', text: 'Tirar o servidor MCP "reldor" do Claude Code (claude mcp remove --scope user reldor)', apply: () => {
      const r = run(where.claudeBin, ['mcp', 'remove', '--scope', 'user', 'reldor'], { timeout: 30000 });
      if (!r.ok) throw new Error(`claude mcp remove falhou: ${(r.stderr || r.stdout).trim().split('\n').pop()}`);
    } });
  }
  notes.push('O programa continua instalado. Para tirar também: npm uninstall -g reldor');
  return { steps, notes };
}

/** Saves (or, after an undo, removes) the list of what the setup did. */
function writeManifest(where, done, undo) {
  try {
    if (undo) {
      fs.rmSync(where.manifest, { force: true });
      return;
    }
    let before = {};
    try {
      before = JSON.parse(fs.readFileSync(where.manifest, 'utf8'));
    } catch {
      /* first time */
    }
    const added = [...new Set([...(before.added || []), ...done.filter((d) => d !== 'install')])];
    fs.mkdirSync(path.dirname(where.manifest), { recursive: true });
    fs.writeFileSync(where.manifest, `${JSON.stringify({ added, npmPrefix: where.npmPrefix, updated: new Date().toISOString() }, null, 2)}\n`);
  } catch {
    /* the manifest only helps; never fail for it */
  }
}

async function setupCommand(root, flags) {
  const where = locate(flags);
  const undo = Boolean(flags.undo);
  const { steps, notes, serverPath } = undo ? planUndo(where) : planInstall(where, flags);
  const title = undo ? '\n🛡️  Reldor · desfazer a instalação' : '\n🛡️  Reldor · instalação';

  if (!steps.length) {
    if (flags.json) printJson({ done: [], skipped: [], notes, ok: true });
    else print([title, '', undo ? '✅ Não há nada do Reldor para tirar.' : '✅ Já está tudo pronto.', ...notes.map((n) => `ℹ️  ${n}`), ...(undo ? [] : ['', '➡️  Na sua IA, num chat novo: "quero usar o Reldor".'])]);
    return 0;
  }
  // Without a terminal to ask (an AI running it) and without --yes: show the plan, change nothing.
  if (!flags.yes && !process.stdin.isTTY) {
    if (flags.json) printJson({ done: [], planned: steps.map((s) => s.id), notes });
    else print([title, '', 'Posso fazer, um de cada vez (pergunto antes de cada um):', ...steps.map((s, i) => `   ${i + 1}. ${s.text}`), '', 'Nada foi alterado. Rode no seu terminal para responder, ou com --yes para aceitar todos.']);
    return 0;
  }

  if (!flags.json) print([title, '', 'Pergunto antes de cada mudança. Cada arquivo que eu mudar fica com uma cópia .reldor-backup.']);
  const rl = flags.yes ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
  const done = [];
  const skipped = [];
  try {
    for (const s of steps) {
      if (!(await ask(rl, `\n• ${s.text}\n  Posso?`, flags))) {
        skipped.push(s.id);
        continue;
      }
      if (s.id === 'install') {
        const r = run('npm', ['install', '-g', SOURCE], { timeout: 10 * 60 * 1000 });
        if (!r.ok) {
          print([`❌ O npm install falhou: ${(r.stderr || r.stdout).split('\n').slice(-3).join(' ')}`, '   Nada mais foi alterado. Veja o "Deu problema?" do README.']);
          return 1;
        }
      } else {
        try {
          s.apply();
        } catch (error) {
          notes.push(error.message);
          continue;
        }
      }
      done.push(s.id);
    }
  } finally {
    if (rl) rl.close();
  }
  writeManifest(where, done, undo && !skipped.length);

  if (flags.json) {
    printJson({ done, skipped, notes, ...(undo ? {} : { server: serverPath }) });
    return 0;
  }
  print([
    '',
    done.length ? `✅ Pronto (${done.length} de ${steps.length}).` : 'Nada foi alterado.',
    ...notes.map((n) => `ℹ️  ${n}`),
    ...(done.length ? ['', '➡️  Feche e abra a sua IA (no Kiro: "Developer: Reload Window") e feche os terminais antigos dela.'] : []),
    ...(undo || !done.length ? [] : ['➡️  Num chat novo: "quero usar o Reldor".']),
  ]);
  return 0;
}

module.exports = { setupCommand, readJsonc };
