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
4. **No Windows, deixa o Git Bash como terminal padrão do Kiro.** O Kiro roda os comandos da IA no terminal padrão. No cmd ou num PowerShell restrito, ele não consegue saber quando o comando terminou: o comando volta embaralhado ("reldorreldor") e a IA espera minutos. No Git Bash (que vem com o Git), a resposta volta direto.
5. **Libera os comandos `reldor ...` nas permissões do Kiro** (`~/.kiro/settings/permissions.yaml`), para ele parar de pedir aprovação a cada comando. É seguro: o Reldor nunca roda Git nem mexe na org.

Antes de mudar, ele mostra a lista e pede um "sim". Cada arquivo do Kiro que ele muda ganha uma cópia `.reldor-backup`. Pode rodar de novo quando quiser: o que já está certo ele pula.

O power do Reldor (passo 3 do README) continua sendo importado no Kiro: é ele que ensina a IA a usar o Reldor.

## Quando usar

Uma vez, logo depois de ler o README. De novo para atualizar.

## Está funcionando se

- No Kiro, o Reldor responde sem o comando aparecer no terminal.
- `reldor --version` funciona nos terminais do Kiro.

## Perguntas comuns

**O MCP está bloqueado pela empresa** (no Kiro aparece "1 server hidden · MCP Registry").
A empresa só libera os servidores da lista dela. Tudo continua funcionando pelo terminal, e com os passos 4 e 5 ele fica rápido. Para usar o MCP, a TI precisa colocar o Reldor na lista.

**Ele disse que não conseguiu ler um arquivo do Kiro.**
O arquivo tem algo que ele não entende, e ele não mexe. Ele mostra a linha para você colar à mão.

## Onde se encaixa

É o passo 2 da instalação. Depois, o [`doctor`](./doctor.md) confere tudo.
