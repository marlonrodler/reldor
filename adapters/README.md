<p align="center"><strong>Português</strong> · <a href="./README.en.md">English</a></p>

# Adaptadores

As skills são escritas uma vez só (`skills/` e `modules/*/advisors/`). Cada IDE só precisa do seu manifesto.

- **Claude Code** instala direto deste repositório: `.claude-plugin/plugin.json` lista as skills e
  `.claude-plugin/marketplace.json` faz do repositório o próprio marketplace.
- **Kiro** usa `adapters/kiro/plugin.json`. O `npm run build:adapters` grava o plugin pronto em `plugins/kiro/reldor`,
  que vai no commit para o Kiro instalar pelo link do GitHub (Powers → Add Custom Power → Import power from GitHub).
  Rode depois de mudar qualquer skill: um teste falha enquanto a cópia estiver desatualizada.

O `npm run build:adapters` também grava `dist/claude/reldor`, uma cópia completa para instalar sem internet.
