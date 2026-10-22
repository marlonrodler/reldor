#!/usr/bin/env node
'use strict';

/**
 * Reldor as an MCP server (stdio, JSON-RPC 2.0, one message per line). The IDE's AI calls the Reldor directly, with
 * no terminal in between: no echoed or glued commands, no waiting for a terminal that never says "done", no PATH.
 * Two tools: reldor_ler (commands that only read or build commands) and reldor_mudar (commands that change files of
 * the project or the Reldor config, which the AI runs only after a "yes" in the chat). Git and the org are never
 * touched by either: the Reldor only hands over those commands.
 */
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const pkg = require('../../package.json');

const CLI = path.join(__dirname, '..', 'cli', 'index.js');
const READ = ['status', 'task', 'refine', 'explain', 'usages', 'access', 'helpers', 'limits', 'review', 'commit', 'deploy', 'merge', 'promote', 'rollback', 'doctor', 'env', 'me', 'tools', 'test-radar', 'security', 'quality', 'check', 'retrieve', 'index', 'log', 'collisions', 'help'];
const CHANGE = ['init', 'profile', 'xml', 'hook', 'merge', 'tools', 'env', 'me', 'task', 'snapshot'];

const schema = (list) => ({
  type: 'object',
  properties: {
    command: { type: 'string', enum: [...new Set(list)], description: 'O comando do Reldor (sem a palavra reldor)' },
    args: { type: 'array', items: { type: 'string' }, description: 'Os argumentos, um por item. Ex.: ["--json"], ["Opportunity", "--json"]' },
    folder: { type: 'string', description: 'A pasta do projeto Salesforce (caminho completo). Sem ela, a pasta onde o Kiro abriu o servidor.' },
  },
  required: ['command'],
});

const TOOLS = [
  { name: 'reldor_ler', description: 'Roda um comando do Reldor que só lê o projeto ou monta comandos (status, task, refine, explain, usages, access, helpers, limits, review, commit, deploy, merge --check, promote, rollback, test-radar, doctor...). Não muda nada. Use --json.', inputSchema: schema(READ) },
  { name: 'reldor_mudar', description: 'Roda um comando do Reldor que muda arquivos do projeto ou a configuração do Reldor (init, profile, xml --yes, hook install --yes, merge --resolve --yes, merge install --yes, tools set, env, me, task set/use/output, snapshot). Só depois de um "sim" da pessoa no chat.', inputSchema: schema(CHANGE) },
];

/** Runs one Reldor command in its own process, the same way the terminal would, and returns its output. */
function runReldor(tool, { command, args = [], folder }) {
  const allowed = tool === 'reldor_ler' ? READ : CHANGE;
  if (!allowed.includes(command)) return { text: `⚠️ ${command} não é um comando de ${tool}. Use ${tool === 'reldor_ler' ? 'reldor_mudar' : 'reldor_ler'}.`, error: true };
  const list = Array.isArray(args) ? args.map(String) : [];
  // In reldor_ler, a command never confirms a change: --yes is only for reldor_mudar.
  if (tool === 'reldor_ler' && list.includes('--yes')) return { text: '⚠️ --yes muda arquivos: use reldor_mudar, depois do "sim" da pessoa.', error: true };
  const cwd = folder || process.env.RELDOR_PROJECT || process.cwd();
  const r = spawnSync(process.execPath, [CLI, command, ...list], { cwd, encoding: 'utf8', input: '', timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, RELDOR_VIA_MCP: '1' } });
  if (r.error) return { text: `⚠️ Não consegui rodar o Reldor: ${r.error.message}`, error: true };
  const out = `${r.stdout || ''}${r.stderr ? `\n${r.stderr}` : ''}`.trim() || '(sem saída)';
  const max = 60000;
  return { text: out.length > max ? `${out.slice(0, max)}\n… (cortado: ${out.length} caracteres; peça uma parte só ou use --out)` : out, error: r.status !== 0 && r.status !== 2 };
}

/** Answers one JSON-RPC request; returns null for notifications. */
function handle(msg) {
  const { id, method, params = {} } = msg;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  if (id === undefined || id === null) return null;
  switch (method) {
    case 'initialize':
      return reply({ protocolVersion: params.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'reldor', version: pkg.version } });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return { jsonrpc: '2.0', id, error: { code: -32602, message: `Ferramenta desconhecida: ${params.name}` } };
      const r = runReldor(tool.name, params.arguments || {});
      return reply({ content: [{ type: 'text', text: r.text }], isError: r.error });
    }
    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Método não suportado: ${method}` } };
  }
}

/** Reads one JSON message per line from stdin and writes the answers to stdout. */
function serve(input = process.stdin, output = process.stdout) {
  let buffer = '';
  input.setEncoding('utf8');
  input.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        output.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } })}\n`);
        continue;
      }
      const res = handle(msg);
      if (res) output.write(`${JSON.stringify(res)}\n`);
    }
  });
}

if (require.main === module) serve();

module.exports = { handle, runReldor, TOOLS, READ, CHANGE, serve };
