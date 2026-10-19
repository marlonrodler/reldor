<p align="center"><a href="./AGENTS.md">Português</a> · <strong>English</strong></p>

# Working on Reldor

Rules for any agent (or person) changing this repository.

## The product rule
Scripts do the heavy, reliable work; the AI only interprets and explains. A feature that needs facts about the org
(automations, references, conflicts) computes them in `core/` or `modules/`, never in a `SKILL.md`.

## Never put a client in Reldor
No client names, internal tool names, team names, branch names, org aliases or code samples from a real client in
this repository: not in code, docs, tests, fixtures or commit messages. Client specifics live in the client's own
`.reldor/` folder. Fixtures use invented names.

## Layout
- `core/`: generic, knows nothing about Salesforce. Modules plug in through `core/modules/index.js`
  (contract: `name`, `label`, `matches`, `detect`, `statusLines`, `profileLines`, and the optional `doctorChecks`).
- `modules/sf/`: everything Salesforce. Advisors are skills in `modules/sf/advisors/<name>/SKILL.md`.
- `skills/`: core skills. `skills/reldor` is the router.
- `.claude-plugin/plugin.json` lists every shipped skill. `adapters/kiro/plugin.json` is the Kiro manifest;
  `npm run build:adapters` writes the ready Kiro plugin to `plugins/kiro/reldor` (committed; a test checks it is current).

## Docs: always in Portuguese and English
Every document has two versions: `<name>.md` in **Portuguese** (the main one) and `<name>.en.md` in **English**. Both open
with the language switcher, Portuguese first. This covers the README, the CHANGELOG, the glossary, this file, `docs/`,
the ADRs and the advisors. Skills (`SKILL.md`) are instructions for the AI and have one version.

## Every new or changed feature
1. Code plus tests (`npm test` must pass; the sample project lives in `test/fixtures/sample-sf`).
2. A page in `docs/<name>.md` and `docs/<name>.en.md`. Sections: What it does, When to reach for it, It's working if,
   Common questions (when there are real ones), Where it fits.
3. An entry in the Reference section of `README.md` and `README.en.md`.
4. A new skill also goes into `.claude-plugin/plugin.json` (`test/repo.test.js` checks this).
5. If a command was added, update `skills/reldor/SKILL.md` ("Commands available today") and `skills/reldor/guide.md`.
6. A line in `CHANGELOG.md` and `CHANGELOG.en.md`. Bump `package.json` and `.claude-plugin/plugin.json` versions together,
   and run `npm run build:adapters`.

## Writing
- Skills answer in the language of the conversation (or `language` in the client's config), short and didactic:
  summary first, details after.
- Terms follow the [GLOSSARY](./GLOSSARY.en.md).
- Code: English identifiers, a short comment before each function, Windows-friendly (use `core/util/exec.js`).
- Big decisions get an ADR in `docs/adr/`.
