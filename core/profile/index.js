'use strict';

/**
 * profile.md: what the AI and the team read about the project. Two parts:
 *   - between the markers, what the Reldor reads from the project (rewritten by `reldor profile`);
 *   - the team's section, written by people and never touched by the Reldor.
 */
const fs = require('node:fs');
const path = require('node:path');
const { paths } = require('../config');

const START = '<!-- reldor:auto:start (o Reldor reescreve esta parte; rode reldor profile para atualizar) -->';
const END = '<!-- reldor:auto:end -->';
const TEAM = [
  '## Padrões da equipe',
  '',
  '<!-- O Reldor nunca muda esta parte. Para preencher com ajuda, peça à sua IA: "me ajude a preencher o profile do Reldor". -->',
  '',
  '- Prefixos ou pastas por time:',
  '- Classes compartilhadas (falar com o time antes de mexer):',
  '- Quando usar Flow e quando usar Apex:',
  '- Regras de nome além das que o Reldor encontrou:',
  '- Outras combinações do time:',
  '',
];

/** Splits an existing profile into the team's part (kept as is). Old files without markers keep "## Padrões da equipe" on. */
function teamPart(text) {
  if (!text) return TEAM.join('\n');
  const end = text.indexOf(END);
  if (end >= 0) return text.slice(end + END.length).replace(/^\s*\n/, '');
  const idx = text.search(/^## Padrões da equipe/m);
  return idx >= 0 ? text.slice(idx) : `${TEAM.join('\n')}\n## Notas anteriores\n\n${text}`;
}

/** Writes profile.md: the automatic part from the modules, the team's part preserved. Returns the module facts. */
function writeProfile(root, { modules, designSystem, specs }) {
  const file = paths(root).profile;
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const facts = {};
  const auto = [
    '# Perfil do projeto',
    '',
    START,
    '',
    `- Design system de telas: ${designSystem || 'slds'}`,
    `- Specs encontradas: ${specs.length ? specs.map((s) => s.path).join(', ') : 'nenhuma'}`,
    '',
  ];
  for (const { mod, facts: detected } of modules) {
    if (typeof mod.profileAuto === 'function') {
      const r = mod.profileAuto(root);
      facts[mod.name] = r.facts;
      auto.push(...r.lines, '');
    } else auto.push(...mod.profileLines(detected), '');
  }
  auto.push(END, '');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${auto.join('\n')}\n${teamPart(before)}`, 'utf8');
  return { file, facts };
}

module.exports = { writeProfile, teamPart, START, END };
