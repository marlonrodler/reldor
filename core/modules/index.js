'use strict';

/**
 * Loads technology modules by name. The core only calls the module contract:
 *   name, label, detect(root) -> facts, statusLines(facts) -> string[], profileLines(facts) -> string[],
 *   and optionally profileAuto(root) -> { facts, lines } (the automatic part of profile.md, from a full read),
 *   doctorChecks(root, { inProject }) -> checks for `reldor doctor`,
 *   capabilities -> [{ id, label, kind, modes, where }] and detectTools(root) -> signs of other tools (`reldor tools`)
 * so a new module (mobile, web) plugs in without changing the core.
 */
const REGISTRY = {
  sf: () => require('../../modules/sf'),
};

function loadModules(names = []) {
  const modules = [];
  for (const name of names) {
    const factory = REGISTRY[name];
    if (factory) modules.push(factory());
  }
  return modules;
}

/** Modules whose project type is detected, even without config (used by init). */
function detectModules(root) {
  return Object.keys(REGISTRY)
    .map((name) => REGISTRY[name]())
    .filter((mod) => typeof mod.matches === 'function' && mod.matches(root));
}

module.exports = { loadModules, detectModules, REGISTRY };
