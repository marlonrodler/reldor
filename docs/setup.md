<p align="center"><strong>Português</strong> · <a href="./setup.en.md">English</a></p>

# setup

## O que faz

Um comando para instalar e deixar o Kiro pronto:

```bash
npx github:marlonrodler/reldor setup
```

1. **Instala o Reldor** para o seu usuário (`npm install -g`, sem administrador).
2. **Liga o Reldor no Kiro como servidor MCP** (`~/.kiro/settings/mcp.json`): a IA chama o Reldor direto, sem passar pelo terminal. Acaba o comando repetido ("reldorreldor"), a espera até o Kiro desistir e o "--out". As leituras rodam sem pedir aprovação; o que muda arquivos continua pedindo.
3. **No Windows, coloca a pasta do npm no PATH só dos terminais do Kiro** (nas configurações do próprio Kiro): sem mexer nas variáveis do Windows e sem pedir à TI.

Antes de mudar, ele mostra a lista e pede um "sim". Cada arquivo do Kiro que ele muda ganha uma cópia `.reldor-backup`. Pode rodar de novo quando quiser: o que já está certo ele pula.

O power do Reldor (passo 3 do README) continua sendo importado no Kiro: é ele que ensina a IA a usar o Reldor.

## Quando usar

Uma vez, logo depois de ler o README. De novo para atualizar.

## Está funcionando se

- No Kiro, o Reldor responde sem o comando aparecer no terminal.
- `reldor --version` funciona nos terminais do Kiro.

## Perguntas comuns

**O MCP está bloqueado pela empresa.**
Tudo continua funcionando pelo terminal, como antes; a IA só demora mais.

**Ele disse que não conseguiu ler um arquivo do Kiro.**
O arquivo tem algo que ele não entende, e ele não mexe. Ele mostra a linha para você colar à mão.

## Onde se encaixa

É o passo 2 da instalação. Depois, o [`doctor`](./doctor.md) confere tudo.
