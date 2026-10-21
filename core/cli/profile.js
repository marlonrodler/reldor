'use strict';

/**
 * reldor profile [--json]: rereads the project and rewrites the automatic part of .reldor/profile.md (between the
 * markers). The team's section stays exactly as it was.
 */
const path = require('node:path');
const { loadConfig } = require('../config');
const { loadModules, detectModules } = require('../modules');
const { findSpecs } = require('../spec');
const { writeProfile } = require('../profile');
const { logAction } = require('../log');
const { print, printJson } = require('../report');

async function profileCommand(root, flags) {
  const { config, exists } = loadConfig(root);
  const mods = exists ? loadModules(config.modules) : detectModules(root);
  const modules = mods.map((mod) => ({ mod, facts: mod.detect(root, { skipCli: true }) }));
  const designSystem = config.advisors?.design_system || 'slds';
  const { file, facts } = writeProfile(root, { modules, designSystem, specs: findSpecs(root, config) });
  logAction(root, 'profile', { summary: 'parte automática do profile.md atualizada' });
  if (flags.json) {
    printJson({ file: path.relative(root, file), facts });
    return 0;
  }
  print([
    `✅ ${path.relative(root, file)} atualizado com o que está no projeto hoje.`,
    '• A parte "Padrões da equipe" ficou como estava: ela é do time.',
    '• Para preencher essa parte com ajuda, peça à sua IA: "me ajude a preencher o profile do Reldor".',
  ]);
  return 0;
}

module.exports = { profileCommand };
