<p align="center"><strong>Português</strong> · <a href="./setup.en.md">English</a></p>

# setup

## O que faz

Um comando para instalar o Reldor e ligá-lo nas IAs desta máquina:

```bash
npx github:marlonrodler/reldor setup
```

Ele **pergunta antes de cada mudança**, uma de cada vez:

1. **Instalar o Reldor** para o seu usuário (`npm install -g`, sem administrador).
2. **Registrar o Reldor como servidor MCP no Kiro** (`~/.kiro/settings/mcp.json`), se o Kiro estiver instalado: a IA chama o Reldor direto, sem terminal.
3. **No Windows, pôr a pasta do npm no PATH só dos terminais do Kiro** (nas configurações do próprio Kiro), sem mexer nas variáveis do Windows.
4. **Registrar o Reldor como servidor MCP no Claude Code** (`claude mcp add --scope user`), se o Claude Code estiver instalado.

O que ele **não** faz: não troca o terminal padrão e não mexe nas permissões. A sua IA continua pedindo aprovação antes de rodar um comando, como você deixou.

Cada arquivo que ele muda ganha uma cópia `.reldor-backup`, e o que ele fez fica anotado em `~/.reldor/setup.json`. Pode rodar de novo quando quiser: o que já está certo ele pula. Com `--yes`, aceita todas as perguntas.

**`reldor setup --undo`** tira exatamente o que o setup colocou: o servidor MCP (Kiro e Claude Code) e o PATH dos terminais do Kiro. Também tira o que a versão 0.25 colocava: a liberação automática dos comandos `reldor ...` nas permissões do Kiro e, numa pergunta separada (porque pode ter sido escolha sua), o Git Bash como terminal padrão. O programa continua instalado; para tirar também: `npm uninstall -g reldor`.

O power do Reldor (passo 3 do README) continua sendo importado no Kiro: é ele que ensina a IA a usar o Reldor.

## Quando usar

Uma vez, logo depois de ler o README. De novo para atualizar. `--undo` para voltar a sua IA como estava.

## Está funcionando se

- No Kiro ou no Claude Code, o Reldor responde sem o comando aparecer no terminal.
- `reldor --version` funciona nos terminais do Kiro.

## Perguntas comuns

**O MCP está bloqueado pela empresa** (no Kiro aparece "1 server hidden · MCP Registry").
A empresa só libera os servidores da lista dela. Tudo continua funcionando pelo terminal: a resposta de cada comando também fica em `.reldor/work/output/` (veja o [`output`](./output.md)), e a IA lê dali se o terminal embaralhar. Para usar o MCP, a TI precisa colocar o Reldor na lista.

**Ele disse que não conseguiu ler um arquivo.**
O arquivo tem algo que ele não entende, e ele não mexe. Ele mostra a linha para você colar à mão.

## Onde se encaixa

É o passo 2 da instalação. Depois, o [`doctor`](./doctor.md) confere tudo.
