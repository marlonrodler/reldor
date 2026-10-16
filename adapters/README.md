# Adapters

Skills are written once (`skills/` and `modules/*/advisors/`). Each IDE only needs its manifest.

- **Claude Code** installs straight from this repository: `.claude-plugin/plugin.json` lists the skills and
  `.claude-plugin/marketplace.json` makes the repo its own marketplace.
- **Kiro** uses `adapters/kiro/plugin.json`. Run `npm run build:adapters` and install `dist/kiro/reldor` as a local plugin.

`npm run build:adapters` also writes `dist/claude/reldor`, a self-contained copy for offline installs.
