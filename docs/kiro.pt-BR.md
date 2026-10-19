<p align="center"><a href="./kiro.md">English</a> · <strong>Português</strong></p>

# Ligar o Reldor no Kiro, passo a passo

No Kiro, um plugin se chama **power**. Instalar o power do Reldor ensina o agente do Kiro a usar o Reldor: depois disso, você conversa e ele roda os comandos.

Antes de começar, o comando `reldor` já precisa estar instalado (passo 2 do [README](../README.pt-BR.md#2-instale-o-comando-reldor)). O power só ensina a IA; quem faz o trabalho é o comando.

Existem dois jeitos. Use o **A** se o repositório do Reldor for público. Se ele for privado, use o **B**.

## A. Pelo link do GitHub

1. Abra o Kiro.
2. Na barra de ícones da esquerda, clique no ícone do **fantasminha do Kiro com um raio** ⚡. Abre o painel **Powers**.
3. No painel, clique no botão **Add Custom Power**.
4. Aparece uma lista de opções. Clique em **Import power from GitHub**.
5. Aparece uma caixa de texto. Cole este link, exatamente assim:
   ```
   https://github.com/marlonrodler/reldor/tree/main/plugins/kiro/reldor
   ```
   Repare que o link termina em `plugins/kiro/reldor`. Se colar só `https://github.com/marlonrodler/reldor`, o Kiro não acha o power.
6. Clique em **Install**.
7. O **reldor** aparece na lista de powers instalados. Pronto.

**Para atualizar** quando sair versão nova: no painel Powers, clique no **reldor**, depois em **Check for updates** e, se houver, em **Install updates**.

## B. Por uma pasta no seu computador (repositório privado)

O Kiro não entra em repositório privado pelo link. Então você baixa o Reldor numa pasta e aponta o Kiro para ela.

**1. Baixe o Reldor numa pasta sua** (uma vez só). No PowerShell:

```powershell
mkdir C:\Users\$env:USERNAME\ferramentas
cd C:\Users\$env:USERNAME\ferramentas
git clone https://github.com/marlonrodler/reldor.git
```

Agora existe a pasta `C:\Users\<você>\ferramentas\reldor`. Não use uma pasta do OneDrive.

**2. Importe no Kiro:**

1. Abra o Kiro e clique no ícone do **fantasminha com raio** ⚡ na barra da esquerda. Abre o painel **Powers**.
2. Clique em **Add Custom Power**.
3. Clique em **Import power from a folder**.
4. Abre a janela de escolher pasta do Windows. Navegue até:
   ```
   C:\Users\<você>\ferramentas\reldor\plugins\kiro\reldor
   ```
   Entre **até a última pasta `reldor`**, a que tem o arquivo `plugin.json` e a pasta `skills` dentro. Se escolher a primeira pasta `reldor` (a de cima), o Kiro não acha o power.
5. Clique em **Selecionar pasta** e depois em **Install**.
6. O **reldor** aparece na lista de powers instalados. Pronto.

**Para atualizar** quando sair versão nova:

```powershell
cd C:\Users\$env:USERNAME\ferramentas\reldor
git pull
```

Depois repita a importação (passos 1 a 5).

## Conferir que funcionou

1. No Kiro, abra a pasta do seu projeto Salesforce (**File → Open Folder**).
2. Abra um **chat novo** no Kiro. Um chat aberto antes da instalação não conhece o power.
3. Escreva: **quero usar o Reldor**.
4. O Kiro deve rodar `reldor status` e responder em que etapa você está, ou começar a configuração do projeto.

Também dá para clicar em **Try the power** no painel Powers: o Kiro abre um chat já com o Reldor ativo.

## Deu problema?

- **Não acho o ícone do fantasminha com raio.** Ele fica na barra vertical de ícones da esquerda, junto com o explorador de arquivos e a busca. Se não aparecer, atualize o Kiro: os powers chegaram nas versões mais novas.
- **"Import power from GitHub" deu erro.** Confira se o link termina em `plugins/kiro/reldor`. Se o repositório for privado, use o caminho B.
- **"Import power from a folder" não aceitou a pasta.** Você escolheu a pasta errada. A certa tem o `plugin.json` dentro: `...\reldor\plugins\kiro\reldor`.
- **A IA respondeu que não conhece o Reldor.** Abra um chat novo. Se continuar, confira se o **reldor** está na lista do painel Powers.
- **A IA conhece o Reldor, mas o comando falha.** Falta o comando `reldor` no computador. Num terminal, rode `reldor doctor`. Se ele não for reconhecido, volte ao passo 2 do README.
