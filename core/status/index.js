'use strict';

const gitApi = require('../git');
const { loadConfig, gitActionsOn, baseBranch } = require('../config');
const { findSpecs, specForBranch } = require('../spec');
const { loadModules } = require('../modules');

/**
 * Where is this feature in the environment chain?
 * The base is the last environment (production): commits already there are not "the feature".
 */
function environmentStatus(root, environments, branch, baseName) {
  if (!environments.length) return { configured: false, items: [] };
  const base = gitApi.resolveBranch(root, baseName || environments[environments.length - 1].branch);
  const items = environments.map((env) => {
    const ref = gitApi.resolveBranch(root, env.branch);
    if (!ref) return { name: env.name, branch: env.branch, state: 'unknown', reason: 'branch não encontrada' };
    if (branch === env.branch) return { name: env.name, branch: env.branch, ref, state: 'current' };
    const missing = gitApi.missingCommits(root, { target: ref, base: ref === base ? null : base });
    if (missing === null) return { name: env.name, branch: env.branch, ref, state: 'unknown', reason: 'não consegui comparar' };
    return { name: env.name, branch: env.branch, ref, state: missing.length === 0 ? 'present' : 'missing', missing: missing.length };
  });
  const featureCommits = base ? gitApi.missingCommits(root, { target: base }) : null;
  return { configured: true, base, featureCommits: featureCommits ? featureCommits.length : null, items };
}

/** Suggests the single most useful next step, in plain words. */
function nextStep(s) {
  if (!s.git.repo) return { id: 'git', text: 'Abra o Reldor dentro de um repositório Git.' };
  if (!s.config.exists) return { id: 'init', text: 'Configurar o Reldor neste projeto (reldor init).' };
  if (s.tools && s.tools.suggestions.length) return { id: 'tools', text: `Encontrei ${s.tools.suggestions.length} sinal(is) de ferramentas do time que já fazem o que o Reldor faz. Confira com "reldor tools" para o Reldor não repetir trabalho.` };
  const pending = Object.values(s.git.pending).reduce((n, list) => n + list.length, 0);
  if (pending > 0) return { id: 'commit', text: `Você tem ${pending} arquivo(s) não commitado(s). Revisar e commitar.` };
  const env = s.environments;
  if (env.configured && s.environments.featureCommits) {
    const next = env.items.find((i) => i.state === 'missing');
    const blocking = (s.alerts || []).filter((a) => a.level === 'alta');
    if (next && blocking.length) return { id: 'fix', target: next.name, text: `Antes de levar para ${next.name}, veja os avisos 🔴 acima: eles fazem a esteira falhar.` };
    if (next) return { id: 'promote', target: next.name, text: `Levar a feature para ${next.name}${(s.alerts || []).length ? ' (veja os avisos acima)' : ': o ensaio não achou problemas'}.` };
    if (env.items.every((i) => i.state === 'present' || i.state === 'current')) {
      return { id: 'done', text: 'A feature já está em todos os ambientes.' };
    }
  }
  if (!s.spec.current && s.spec.available.length === 0) {
    return { id: 'spec', text: 'Começar pela task: refinar a ideia ou gerar a spec.' };
  }
  return { id: 'develop', text: 'Seguir com o desenvolvimento.' };
}

/** Builds the full status. Pure data: the CLI decides how to show it. */
function buildStatus(root, options = {}) {
  const { config, exists, file } = loadConfig(root);
  const repo = gitApi.isRepo(root);
  if (repo && options.fetch) gitApi.fetch(root);
  const branch = repo ? gitApi.currentBranch(root) : null;
  const pending = repo ? gitApi.pendingChanges(root) : { modified: [], added: [], deleted: [], untracked: [] };
  const specs = findSpecs(root, config);
  const modules = loadModules(config.modules).map((mod) => ({ mod, facts: mod.detect(root, options) }));

  const status = {
    root,
    config: { exists, file },
    git: { repo, branch, pending, actions: gitActionsOn(config) ? 'on' : 'off' },
    environments: repo ? environmentStatus(root, config.environments || [], branch, baseBranch(config)) : { configured: false, items: [] },
    spec: { current: specForBranch(specs, branch), available: specs.slice(0, 5) },
    modules: modules.map(({ mod, facts }) => ({ name: mod.name, label: mod.label, facts })),
  };
  // Who takes care of what (tools: in the config) and signs of team tools not configured yet.
  try {
    const { toolsReport } = require('../tools');
    const report = toolsReport(root, config, { withDetection: options.detectTools !== false });
    status.tools = {
      others: report.capabilities.filter((c) => c.mode !== 'run').map((c) => ({ id: c.id, mode: c.mode, owner: c.owner })),
      suggestions: report.suggestions.map((x) => ({ capability: x.capability, suggested: x.suggested, owner: x.owner })),
    };
  } catch {
    status.tools = { others: [], suggestions: [] };
  }
  status.alerts = [];
  if (options.alerts !== false && exists) {
    for (const { mod } of modules) {
      if (typeof mod.alerts !== 'function') continue;
      try {
        status.alerts.push(...mod.alerts(root, config, status));
      } catch {
        /* a warning must never break status */
      }
    }
  }
  status.next = nextStep(status);
  return { status, modules };
}

module.exports = { buildStatus, nextStep, environmentStatus };
