'use strict';

/**
 * The task being worked on, found by itself: the id in the branch name (feature/1234, feature/team-1234-x,
 * bugfix/ABC-123-y...), a spec of any tool with that id, or the one the person named in the chat (reldor task use).
 * The shape of the branch names is learned from the repository and confirmed once; nothing is fixed to one company.
 * Each task gets a folder (.reldor/work/tasks/<id>/) so switching tasks never mixes them, and coming back resumes.
 */
const fs = require('node:fs');
const path = require('node:path');
const gitApi = require('../git');
const { findSpecs, specsForTask } = require('../spec');

const JIRA = /(?<![A-Za-z0-9])([A-Z][A-Z0-9]{1,9}-\d+)(?![0-9])/;
const NUMBER = /(?:^|[^0-9])(\d{3,})(?![0-9])/g;

/** The task id in a branch name, with the project's own pattern (a regex with one group) when there is one. */
function taskIdFrom(branch, pattern) {
  if (!branch) return null;
  if (pattern) {
    try {
      const m = new RegExp(pattern).exec(branch);
      return m ? m[1] || m[0] : null;
    } catch {
      /* a broken pattern falls back to the generic rule */
    }
  }
  const jira = JIRA.exec(branch);
  if (jira) return jira[1];
  // Dates and versions are not task ids (release/2024-10, hotfix/1.250.3).
  const clean = branch.replace(/(19|20)\d\d[-_.]\d{1,2}([-_.]\d{1,2})?/g, ' ').replace(/\d+(\.\d+)+/g, ' ');
  const nums = [...clean.matchAll(NUMBER)].map((m) => m[1]);
  return nums.length ? nums[nums.length - 1] : null;
}

/** "feature/team-1234-descr" → "feature/<time>-<id>-<descrição>": the shape, without the words of one branch. */
function shapeOf(branch, id) {
  const at = branch.indexOf(id);
  if (at < 0) return null;
  const before = branch.slice(0, at);
  const after = branch.slice(at + id.length);
  const slash = before.lastIndexOf('/');
  const prefix = slash >= 0 ? before.slice(0, slash + 1) : '';
  const middle = before.slice(prefix.length);
  return `${prefix}${middle ? `<time>${middle.slice(-1).replace(/[A-Za-z0-9]/, '')}` : ''}<id>${after ? `${after[0].replace(/[A-Za-z0-9]/, '')}<descrição>` : ''}`;
}

/** The branch shapes of the repository that carry a task id, most common first. */
function learnBranchShapes(branches, environments = []) {
  const envBranches = new Set(environments.map((e) => e.branch));
  const counts = new Map();
  for (const b of branches) {
    if (envBranches.has(b) || /^(main|master|develop|HEAD)$/i.test(b)) continue;
    const id = taskIdFrom(b);
    const shape = id && shapeOf(b, id);
    if (shape) counts.set(shape, (counts.get(shape) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([shape, count]) => ({ shape, count }));
}

/** Folders that look like the project's own documentation (Markdown files, maybe one subfolder per team). */
function findDocFolders(root, { exclude = [], depth = 3 } = {}) {
  const SKIP = new Set(['node_modules', '.git', '.sfdx', '.sf', '.reldor', '.kiro', 'force-app', 'unpackaged', 'dist', 'coverage', 'specs', 'openspec', '.specify', '.github', '.vscode']);
  const out = [];
  const walk = (dir, level) => {
    if (level > depth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const rel = path.relative(root, dir).split(path.sep).join('/');
    if (rel && exclude.some((x) => rel === x || rel.startsWith(`${x}/`))) return;
    const md = entries.filter((e) => e.isFile() && /\.md$/i.test(e.name) && !/^(README|CHANGELOG|LICENSE|CONTRIBUTING)\.md$/i.test(e.name)).length;
    const subs = entries.filter((e) => e.isDirectory() && !SKIP.has(e.name));
    const subsWithMd = subs.filter((s) => {
      try {
        return fs.readdirSync(path.join(dir, s.name)).some((f) => /\.md$/i.test(f));
      } catch {
        return false;
      }
    });
    if (rel && (md >= 3 || subsWithMd.length >= 2)) out.push({ path: rel, markdown: md, folders: subsWithMd.map((s) => s.name).slice(0, 12) });
    for (const s of subs) walk(path.join(dir, s.name), level + 1);
  };
  walk(root, 0);
  return out.sort((a, b) => b.markdown + b.folders.length * 3 - (a.markdown + a.folders.length * 3)).slice(0, 5);
}

const stateFile = (root) => path.join(root, '.reldor', 'work', 'task.json');

/** The last task seen (to notice a switch) and the one the person named, if any. */
function readState(root) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(root), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(root, state) {
  fs.mkdirSync(path.dirname(stateFile(root)), { recursive: true });
  fs.writeFileSync(stateFile(root), JSON.stringify(state, null, 2));
}

/** The folder of one task's work (refined text, targets, results). */
function taskFolder(root, id) {
  return path.join(root, '.reldor', 'work', 'tasks', String(id).replace(/[^\w.-]+/g, '_'));
}

/** What the person is doing on this task, from the facts: refine, develop, review or promote. */
function phaseOf({ spec, pending, ahead }) {
  if (pending) return 'desenvolver';
  if (ahead) return 'promover';
  return spec ? 'desenvolver' : 'refinar';
}

/**
 * The current task: id, where it came from, its spec(s), the phase, its folder and whether it changed since the last
 * look. `remember` saves what was seen, so the next call can say "you switched from X to Y".
 */
function currentTask(root, config, { remember = true, branch, pending = 0, ahead = 0 } = {}) {
  const t = config.task || {};
  const state = readState(root);
  const fromBranch = taskIdFrom(branch, t.branch_pattern);
  let id = fromBranch;
  let source = fromBranch ? 'branch' : null;
  // The one named in the chat wins while the person stays on the same branch.
  if (state.named && state.named.branch === (branch || null)) {
    id = state.named.id;
    source = 'chat';
  }
  const specs = findSpecs(root, config);
  const mine = id || branch ? specsForTask(specs, id, branch) : [];
  const task = {
    id: id || null,
    source,
    branch: branch || null,
    specs: mine.map((s) => ({ path: s.path, tool: s.tool, files: s.files })),
    spec: mine[0] ? mine[0].path : null,
    phase: id ? phaseOf({ spec: mine.length > 0, pending, ahead }) : null,
    folder: id ? path.relative(root, taskFolder(root, id)).split(path.sep).join('/') : null,
    resumed: id ? fs.existsSync(taskFolder(root, id)) : false,
    switched: state.last && id && state.last !== id ? { from: state.last, to: id } : null,
    output: null,
  };
  if (remember && id && state.last !== id) writeState(root, { ...state, last: id });
  return task;
}

/** reldor task use <id>: the person says which task it is (it holds while the branch stays the same). */
function useTask(root, id, branch) {
  const state = readState(root);
  writeState(root, { ...state, named: { id, branch: branch || null } });
  fs.mkdirSync(taskFolder(root, id), { recursive: true });
}

/** reldor task clear: forget the named task. */
function clearTask(root) {
  const state = readState(root);
  delete state.named;
  writeState(root, state);
}

/** Facts for `reldor task`: the current task, the branch shapes, every spec found and the documentation folders. */
function taskReport(root, config, { branch, pending, ahead } = {}) {
  const task = currentTask(root, config, { branch, pending, ahead });
  const branches = gitApi.isRepo(root) ? gitApi.listBranches(root) : [];
  const allSpecs = findSpecs(root, config, { scan: true });
  const exclude = [...new Set(allSpecs.map((s) => path.posix.dirname(s.path)))];
  return {
    task,
    branchPattern: (config.task || {}).branch_pattern || null,
    branchShapes: learnBranchShapes(branches, config.environments || []),
    specPlaces: [...new Map(allSpecs.map((s) => [path.posix.dirname(s.path), { place: path.posix.dirname(s.path), tool: s.tool }])).values()],
    specDir: (config.spec || {}).path || null,
    docsDir: (config.task || {}).docs_dir || null,
    docFolders: (config.task || {}).docs_dir ? [] : findDocFolders(root, { exclude }),
  };
}

module.exports = { taskIdFrom, shapeOf, learnBranchShapes, findDocFolders, currentTask, useTask, clearTask, taskReport, taskFolder, phaseOf };
