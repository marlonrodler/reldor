'use strict';

/**
 * reldor task                                 the current task, where its spec is, the shapes of the branch names
 * reldor task use <id> | clear                the person says which task it is (holds while the branch stays)
 * reldor task set --branch-shape "feature/<time>-<id>-<descrição>" | --branch-pattern "<regex>"
 *                 --spec-dir <pasta> --docs-dir <pasta>      the project's patterns, confirmed once (shared config)
 * reldor task output <spec|md|ambos>          where the refined task goes, for this person (local)
 */
const gitApi = require('../git');
const { loadConfig, readRawConfig, saveConfig, readLocal, saveLocal, baseBranch } = require('../config');
const taskApi = require('../task');
const { logAction } = require('../log');
const { print, printJson } = require('../report');

/** "feature/<time>-<id>-<descrição>" → a regex whose group is the id. */
function shapeToPattern(shape) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = String(shape).split(/(<id>|<time>|<descrição>|<descricao>)/);
  return `^${parts.map((p) => (p === '<id>' ? '([A-Z][A-Z0-9]+-\\d+|\\d+)' : p === '<time>' ? '[^/]+?' : /^<descri/.test(p) ? '.*' : esc(p))).join('')}`;
}

async function taskCommand(root, flags, args) {
  const action = args[0];
  const branch = gitApi.isRepo(root) ? gitApi.currentBranch(root) : null;
  if (action === 'use') {
    if (!args[1]) {
      print('⚠️ Diga o número da tarefa: reldor task use 1234');
      return 1;
    }
    taskApi.useTask(root, args[1], branch);
    logAction(root, 'task', { summary: `tarefa ${args[1]} (dita no chat)` });
  } else if (action === 'clear') {
    taskApi.clearTask(root);
  } else if (action === 'output') {
    const value = String(args[1] || '').toLowerCase();
    if (!['spec', 'md', 'ambos'].includes(value)) {
      print('⚠️ Use: reldor task output spec | md | ambos');
      return 1;
    }
    saveLocal(root, { ...readLocal(root), output: value });
  } else if (action === 'set') {
    const raw = readRawConfig(root);
    raw.task = { ...(raw.task || {}) };
    if (typeof flags['branch-shape'] === 'string') raw.task.branch_pattern = shapeToPattern(flags['branch-shape']);
    if (typeof flags['branch-pattern'] === 'string') raw.task.branch_pattern = flags['branch-pattern'];
    if (typeof flags['docs-dir'] === 'string') raw.task.docs_dir = flags['docs-dir'];
    if (typeof flags['spec-dir'] === 'string') raw.spec = { ...(raw.spec || {}), path: flags['spec-dir'] };
    saveConfig(root, raw);
    logAction(root, 'task-set', { summary: JSON.stringify(raw.task) });
  }

  const { config } = loadConfig(root);
  const pending = gitApi.isRepo(root) ? Object.values(gitApi.pendingChanges(root)).reduce((n, l) => n + l.length, 0) : 0;
  const base = baseBranch(config);
  const ahead = branch && base && base !== branch ? Number(gitApi.git(root, ['rev-list', '--count', `${base}..HEAD`]).stdout) || 0 : 0;
  const r = taskApi.taskReport(root, config, { branch, pending, ahead });
  r.task.output = readLocal(root).output || null;
  if (flags.json) {
    printJson(r);
    return 0;
  }
  const t = r.task;
  const out = ['\n🛡️  Tarefa', ''];
  if (t.switched) out.push(`🔄 Mudou de tarefa: ${t.switched.from} → ${t.switched.to}.`, '');
  if (t.id) {
    out.push(`• Tarefa: ${t.id} (${t.source === 'chat' ? 'dita no chat' : `pela branch ${t.branch}`}) · fase: ${t.phase}`);
    if (t.specs.length === 1) out.push(`• Spec: ${t.spec} (${t.specs[0].tool})`);
    else if (t.specs.length > 1) out.push('• Achei mais de uma spec desta tarefa; qual vale?', ...t.specs.map((x) => `   - ${x.path} (${x.tool})`));
    else out.push('• Não achei a spec desta tarefa. Quer montar uma a partir do card? Ou diga onde ela está.');
    out.push(`• Pasta de trabalho: ${t.folder}${t.resumed ? ' (já tem coisa feita: retomando)' : ''}`);
  } else {
    out.push(`• Não achei o número da tarefa na branch ${branch || '(sem Git)'}. Diga qual é: reldor task use <número>`);
  }
  if (!r.branchPattern && r.branchShapes.length) out.push('', `💡 As branches deste repositório parecem: ${r.branchShapes.map((s) => `${s.shape} (${s.count})`).join(', ')}`, '   Para confirmar: reldor task set --branch-shape "<o formato>"');
  if (r.specPlaces.length) out.push('', `• Lugares com specs: ${r.specPlaces.map((p) => `${p.place} (${p.tool})`).join(', ')}${r.specDir ? ` · escolhido: ${r.specDir}` : ''}`);
  if (r.docsDir) out.push(`• Documentação do time: ${r.docsDir}`);
  else if (r.docFolders.length) out.push('', '💡 Pastas que parecem documentação do projeto (para guardar a task refinada):', ...r.docFolders.map((d) => `   - ${d.path}${d.folders.length ? ` (subpastas: ${d.folders.slice(0, 5).join(', ')}${d.folders.length > 5 ? ', ...' : ''})` : ''}`), '   Para escolher: reldor task set --docs-dir "<pasta>" (use {time} para a subpasta do seu time)');
  out.push(`• A task refinada vai para: ${{ spec: 'a spec', md: 'um .md na documentação', ambos: 'a spec e um .md na documentação' }[t.output] || 'ainda não escolhido (reldor task output spec | md | ambos)'}`);
  print(out);
  return 0;
}

module.exports = { taskCommand, shapeToPattern };
