'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const SERVER = path.join(__dirname, '..', 'core', 'mcp', 'server.js');
const CLI = path.join(__dirname, '..', 'core', 'cli', 'index.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'sample-sf');

// Talks to the MCP server like the IDE does: one JSON message per line.
function talk(messages) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [SERVER], { env: { ...process.env, RELDOR_SF_BIN: '/nonexistent' } });
    const answers = [];
    let buf = '';
    p.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        answers.push(JSON.parse(buf.slice(0, nl)));
        buf = buf.slice(nl + 1);
        if (answers.length === messages.filter((m) => m.id !== undefined).length) {
          p.kill();
          resolve(answers);
        }
      }
    });
    p.on('error', reject);
    for (const m of messages) p.stdin.write(`${JSON.stringify(m)}\n`);
  });
}

test('MCP: the AI calls the Reldor without a terminal; reading and changing are separate tools', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-mcp-'));
  fs.cpSync(FIXTURE, dir, { recursive: true, filter: (s) => !s.includes(`${path.sep}.reldor`) });
  const [init, list, status, blocked, wrong] = await talk([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {} } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'reldor_read', arguments: { command: 'status', args: ['--json', '--quick'], folder: dir } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'reldor_read', arguments: { command: 'xml', args: ['--yes'], folder: dir } } },
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'reldor_read', arguments: { command: 'status', args: ['--yes'], folder: dir } } },
  ]);
  assert.equal(init.result.serverInfo.name, 'reldor');
  assert.equal(init.result.protocolVersion, '2025-03-26');
  assert.deepEqual(list.result.tools.map((t) => t.name), ['reldor_read', 'reldor_change']);
  const s = JSON.parse(status.result.content[0].text);
  assert.ok(s.modules.some((m) => m.name === 'sf'), 'the status of that folder came back as JSON');
  assert.equal(blocked.result.isError, true, 'xml is not a reading command');
  assert.match(wrong.result.content[0].text, /reldor_change/);
});

test('setup: neutral (MCP and PATH only, the IDE keeps asking), safe to run again, and --undo removes it all', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'reldor-home-'));
  const appdata = path.join(home, 'AppData');
  const settings = path.join(appdata, 'Kiro', 'User', 'settings.json');
  fs.mkdirSync(path.dirname(settings), { recursive: true });
  fs.writeFileSync(settings, '{\n  // minhas configurações\n  "editor.fontSize": 14,\n}\n');
  const env = { ...process.env, RELDOR_NPM_ROOT: path.join(home, 'npm', 'node_modules'), RELDOR_NPM_PREFIX: path.join(home, 'npm'), RELDOR_CLAUDE_BIN: path.join(home, 'no-claude') };
  const run = (args) => spawnSync(process.execPath, [CLI, 'setup', '--home', home, '--appdata', appdata, '--no-install', ...args], { encoding: 'utf8', env, input: '' });

  assert.match(run([]).stdout, /Nada foi alterado/, 'without a yes, nothing changes');
  const r = JSON.parse(run(['--yes', '--json']).stdout);
  assert.deepEqual(r.done, ['kiro-mcp', 'kiro-path']);
  const mcp = JSON.parse(fs.readFileSync(path.join(home, '.kiro', 'settings', 'mcp.json'), 'utf8'));
  assert.equal(mcp.mcpServers.reldor.command, process.execPath);
  assert.match(mcp.mcpServers.reldor.args[0], /core[\\/]mcp[\\/]server\.js$/);
  assert.equal(mcp.mcpServers.reldor.autoApprove, undefined, 'the IDE keeps asking');
  let kiro = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(kiro['editor.fontSize'], 14, 'the person settings stay');
  assert.ok(kiro['terminal.integrated.env.windows'].PATH.endsWith(path.join(home, 'npm')));
  assert.equal(kiro['terminal.integrated.defaultProfile.windows'], undefined, 'the terminal is not changed');
  assert.ok(!fs.existsSync(path.join(home, '.kiro', 'settings', 'permissions.yaml')), 'permissions are not changed');
  assert.match(fs.readFileSync(`${settings}.reldor-backup`, 'utf8'), /minhas configurações/, 'the backup is the file as it was');
  assert.match(run(['--yes']).stdout, /Já está tudo pronto/);

  // What 0.25 left behind: Git Bash as default and the "reldor *" rule. --undo takes everything out.
  kiro = { ...kiro, 'terminal.integrated.defaultProfile.windows': 'Git Bash', 'terminal.integrated.profiles.windows': { 'Git Bash': { path: 'C:/Git/bin/bash.exe' } } };
  fs.writeFileSync(settings, JSON.stringify(kiro));
  const permFile = path.join(home, '.kiro', 'settings', 'permissions.yaml');
  fs.writeFileSync(permFile, 'rules:\n  - capability: shell\n    match: ["git status"]\n    effect: allow\n  - capability: shell\n    match: ["reldor *", "reldor.cmd *"]\n    effect: allow\n');
  const u = JSON.parse(run(['--undo', '--yes', '--json']).stdout);
  assert.deepEqual(u.done, ['kiro-mcp', 'kiro-path', 'kiro-terminal', 'kiro-permissions']);
  kiro = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.deepEqual(Object.keys(kiro), ['editor.fontSize'], 'back to how it was');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, '.kiro', 'settings', 'mcp.json'), 'utf8')).mcpServers, {});
  const perm = require('yaml').parse(fs.readFileSync(permFile, 'utf8'));
  assert.deepEqual(perm.rules.map((x) => x.match[0]), ['git status'], 'only the Reldor rule goes');
  assert.match(run(['--undo', '--yes']).stdout, /nada do Reldor para tirar/);
});
