'use strict';

/**
 * The team's tools: who takes care of each thing Reldor can do.
 *
 * Every module lists its capabilities (sort XML, remove duplicates, run the Code Analyzer, run tests...). A project
 * says, in `tools:` of .reldor/reldor.config.yaml, when another tool already does one of them:
 *   run    Reldor does it (the default).
 *   verify Reldor does not do it again; it only checks the result and, if it is not right, says which tool to run.
 *   skip   Reldor stays out: it neither does it nor checks it, and says who takes care of it.
 * Modules also look for signs of those tools in the project (hooks, pipelines, AI instructions) and suggest an entry.
 * The decision is always the person's: suggestions are never written by themselves.
 */
const { readRawConfig, saveConfig } = require('../config');
const { REGISTRY } = require('../modules');

const MODES = ['run', 'verify', 'skip'];
const MODE_LABEL = { run: 'o Reldor faz', verify: 'o Reldor só confere', skip: 'o Reldor fica de fora' };

/** Every capability of every known module: { id, label, kind, modes, where, module }. */
function capabilities() {
  const out = [];
  for (const name of Object.keys(REGISTRY)) {
    const mod = REGISTRY[name]();
    for (const c of mod.capabilities || []) out.push({ ...c, module: mod.name });
  }
  return out;
}

/** One capability by id, or null. */
function capability(id) {
  return capabilities().find((c) => c.id === id) || null;
}

/** How a capability is handled in this project: { id, mode, owner }. */
function resolveTool(config, id) {
  const entry = (config && config.tools && config.tools[id]) || null;
  const cap = capability(id);
  let mode = entry && MODES.includes(entry.mode) ? entry.mode : 'run';
  if (cap && !cap.modes.includes(mode)) mode = 'run';
  return { id, mode, owner: (entry && entry.owner) || null, label: cap ? cap.label : id };
}

/** True when Reldor should do the work itself (mode run). */
function runs(config, id) {
  return resolveTool(config, id).mode === 'run';
}

/** True when Reldor should at least check (run or verify). */
function checks(config, id) {
  return resolveTool(config, id).mode !== 'skip';
}

/** A short sentence saying who takes care of a capability that is not "run". */
function ownerNote(config, id) {
  const t = resolveTool(config, id);
  if (t.mode === 'run') return null;
  const who = t.owner || 'outra ferramenta do time';
  return t.mode === 'verify' ? `${t.label}: quem faz é ${who}; o Reldor só confere.` : `${t.label}: fica com ${who}; o Reldor não faz nem confere.`;
}

/** What to tell the person when a check fails on a capability another tool does. */
function fixHint(config, id, reldorFix) {
  const t = resolveTool(config, id);
  if (t.mode === 'verify') return `Quem faz isso aqui é ${t.owner || 'outra ferramenta do time'}: rode-a de novo nesses arquivos (o Reldor só conferiu).`;
  return reldorFix;
}

/** Checks that a mode is valid for a capability. Returns an error message or null. */
function validate(id, mode) {
  const cap = capability(id);
  if (!cap) return `Não conheço a capacidade "${id}". Veja a lista com: reldor tools`;
  if (!MODES.includes(mode)) return `Modo "${mode}" inválido. Use: ${MODES.join(', ')}.`;
  if (!cap.modes.includes(mode)) return `"${id}" aceita só: ${cap.modes.join(', ')}.`;
  return null;
}

/** Writes one entry into tools: of the project config, keeping the rest of the file. */
function setTool(root, id, mode, owner) {
  const error = validate(id, mode);
  if (error) return { error };
  const raw = readRawConfig(root);
  raw.tools = { ...(raw.tools || {}) };
  // Kept even for "run": it records that the person decided, so the same suggestion does not come back.
  raw.tools[id] = { mode, ...(owner ? { owner } : {}) };
  saveConfig(root, raw);
  return { ok: true };
}

/** Signs of other tools found by the modules: [{ capability, owner, evidence, suggested }]. */
function detect(root) {
  const out = [];
  for (const name of Object.keys(REGISTRY)) {
    const mod = REGISTRY[name]();
    if (typeof mod.detectTools !== 'function') continue;
    try {
      out.push(...mod.detectTools(root));
    } catch {
      /* detection must never break a command */
    }
  }
  return out;
}

/**
 * The whole picture: every capability with its mode and owner, plus the signs found in the project that are not
 * reflected in the config yet (suggestions).
 */
function toolsReport(root, config, { withDetection = true } = {}) {
  const list = capabilities().map((c) => ({ ...c, ...resolveTool(config, c.id) }));
  const found = withDetection ? detect(root) : [];
  const suggestions = [];
  for (const s of found) {
    // Already decided in the config (any mode): not a suggestion anymore.
    if (config && config.tools && config.tools[s.capability]) continue;
    const same = suggestions.find((x) => x.capability === s.capability && x.owner === s.owner);
    if (same) same.evidence.push(...s.evidence);
    else suggestions.push({ ...s, evidence: [...s.evidence] });
  }
  return { capabilities: list, found, suggestions };
}

module.exports = { MODES, MODE_LABEL, capabilities, capability, resolveTool, runs, checks, ownerNote, fixHint, validate, setTool, detect, toolsReport };
