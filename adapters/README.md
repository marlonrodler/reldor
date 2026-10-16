# Cascas por IDE

As skills são escritas uma vez (`skills/` e `modules/*/advisors/`). Aqui ficam só os manifestos de cada IDE.

```bash
npm run build:adapters
```

Gera:
- `dist/claude/reldor/` — plugin do Claude Code (`.claude-plugin/plugin.json` + `skills/`)
- `dist/kiro/reldor/` — plugin do Kiro (`plugin.json` + `skills/`)

## Instalar localmente

**Claude Code:** adicione a pasta `dist/claude/reldor` como plugin local (veja a documentação de plugins do Claude Code).

**Kiro:** instale a pasta `dist/kiro/reldor` como plugin local pelo painel de Powers.

O núcleo `reldor` precisa estar no PATH (`npm install -g .` na raiz deste repositório).
