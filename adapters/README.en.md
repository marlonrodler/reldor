<p align="center"><a href="./README.md">Português</a> · <strong>English</strong></p>

# Adapters

Skills are written once (`skills/` and `modules/*/advisors/`). Each IDE only needs its manifest.

- **Claude Code** installs straight from this repository: `.claude-plugin/plugin.json` lists the skills and
  `.claude-plugin/marketplace.json` makes the repo its own marketplace.
- **Kiro** uses `adapters/kiro/plugin.json`. `npm run build:adapters` writes the ready plugin to `plugins/kiro/reldor`,
  which is committed so Kiro installs it from the GitHub link (Powers → Add Custom Power → Import power from GitHub).
  Run it after changing any skill: a test fails while the committed copy is out of date.

`npm run build:adapters` also writes `dist/claude/reldor`, a self-contained copy for offline installs.
