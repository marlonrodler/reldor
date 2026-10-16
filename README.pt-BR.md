<p align="center"><a href="./README.md">English</a> · <strong>Português</strong></p>

# 🛡️ Reldor: o guardião do desenvolvimento Salesforce

O guardião que lê a sua org antes de a sua IA escrever uma linha de código.

A IA já escreve código Salesforce rápido. O que ela não faz é enxergar a org inteira: o flow que roda antes da sua trigger, a validation rule que vai quebrar os testes de outros times, o roll-up que salva o registro pai junto. E o Git não entende metadados Salesforce: profiles dão conflito sem motivo e os commits levam tudo o que o último retrieve trouxe.

O Reldor resolve isso com uma regra: **scripts fazem o trabalho pesado e confiável; a IA só explica e conduz.** Ele monta um índice do projeto, segue a ordem de execução real e conversa com você pela IA que você já usa (Kiro ou Claude Code). Você não decora comandos: diz o que quer.

> **Status:** Fase 1 concluída; Fase 2 em andamento: revisão de segurança e de qualidade, merge inteligente, ensaio de promoção, commit limpo, organizador de XML e gancho pre-commit já funcionam. Veja o [roadmap](./docs/roadmap.pt-BR.md).

## Instalação (5 minutos)

### 1. Baixe o Reldor

Você precisa de **Node.js 18+** (já vem com o Salesforce CLI), do **Salesforce CLI (`sf`)** e do **Git**.

```bash
git clone https://github.com/marlonrodler/reldor.git
cd reldor
npm install
npm install -g .        # deixa o comando `reldor` disponível no terminal
```

### 2. Ligue na sua IA

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude plugin marketplace add marlonrodler/reldor
claude plugin install reldor@reldor
```

</details>

<details>
<summary><strong>Kiro</strong></summary>

```bash
npm run build:adapters   # cria dist/kiro/reldor
```

Depois, instale a pasta `dist/kiro/reldor` como plugin local pelo painel de Powers.

</details>

<details>
<summary><strong>Só o terminal</strong></summary>

Cada funcionalidade é um comando. Rode `reldor help` para ver a lista.

</details>

### 3. Diga oi

Abra um projeto Salesforce e diga à sua IA:

> Quero usar o Reldor

Ele detecta o projeto, pergunta só o que não consegue descobrir (branches dos ambientes, org de referência, design system) e diz o próximo passo.

## Por que o Reldor existe

### #1: A IA não enxerga a org inteira

**O problema.** A IA lê os arquivos que você mostra. Ela não sabe que um flow before-save já preenche aquele campo, que uma workflow rule faz suas triggers de update rodarem de novo, ou que salvar um registro filho recalcula e salva o pai. Você descobre em UAT.

**A solução.** Um índice montado por scripts, não adivinhado pela IA:

- [`explain`](./docs/explain.pt-BR.md): o que acontece quando um registro é salvo, na ordem de execução real, seguindo a cadeia do fflib pela sua classe `Application`.
- [`usages`](./docs/usages.pt-BR.md): todos os lugares onde um campo, classe, método, flow ou objeto é usado, com o grau de certeza.
- [`refine`](./docs/refine.pt-BR.md): antes mesmo de a task ser escrita, o que ela toca e o que perguntar.

### #2: Testes quebram de surpresa

**O problema.** Uma validation rule nova, um campo obrigatório ou uma permissão quebra testes de outros times. Ninguém percebe até a esteira falhar, horas depois.

**A solução.** O [`test-radar`](./docs/test-radar.pt-BR.md) aponta os testes que a sua mudança pode quebrar, diz por quê e roda na sandbox sem salvar nada. Ele também confere se todo campo lido no código está na query.

### #3: O Git não entende Salesforce

**O problema.** Duas pessoas adicionam classes diferentes no mesmo profile e o Git oferece "tudo ou nada". Um retrieve mistura a org com o seu trabalho. Uma promoção falha porque um campo só existe em develop.

**A solução.** O [`clean`](./docs/clean.pt-BR.md) deixa na pasta só o seu trabalho antes de qualquer ferramenta commitar. Um [merge assistido](./docs/merge.pt-BR.md) faz o `git merge` na branch de merge e resolve os conflitos mantendo o destino e aplicando só a sua mudança, e depois confere se **entrou só o seu**. Um [ensaio de promoção](./docs/promote.pt-BR.md) acha commits fora de ordem e campos que só existem na develop antes da pull request. E mais um [organizador de XML](./docs/xml.pt-BR.md), um gancho pre-commit e um [plano de rollback](./docs/rollback.pt-BR.md) com o revert, o `destructiveChanges.xml` e os riscos.

### #4: Brechas de segurança e código copiado que ninguém viu

**O problema.** Um método de tela que lê dados sem checar permissão, uma query montada concatenando o que o usuário digitou, um `System.debug` com CPF, uma classe que ignora o compartilhamento a três chamadas da tela. Num banco, qualquer uma dessas vira incidente.

**A solução.** O [`security`](./docs/security.pt-BR.md) revisa as suas mudanças antes do commit: regras do próprio Reldor e, quando instalado, o Salesforce Code Analyzer oficial. Ele também segue o **caminho**: da tela ou da API até uma classe `without sharing` que mexe em dados, algo que um scanner arquivo por arquivo não enxerga.

O [`quality`](./docs/quality.pt-BR.md) pega a cópia antes de ela se espalhar: um bloco colado de outra classe, uma query que já mora num Selector, um método que já existe. Só a repetição que a sua mudança cria, mais o PMD e o CPD do Code Analyzer.

### #5: Telas e automações no improviso

**O problema.** A IA já sai codando: mais uma trigger num objeto que já tem uma, `@future` onde cabe Queueable, tela feita com HTML na mão.

**A solução.** Conselheiros que entram **antes** do código, com uma pergunta e sem bloquear nada:

- [spec-review](./docs/advisors/spec-review.pt-BR.md): encontra as lacunas da spec.
- [automation-design](./docs/advisors/automation-design.pt-BR.md): onde a lógica deve morar (flow, trigger, Queueable, Batch), olhando o que já existe.
- [lwc-ux](./docs/advisors/lwc-ux.pt-BR.md): dois ou três caminhos de tela modernos com SLDS, mais uma POC descartável.

## Referência

✅ disponível · 🚧 planejado

### Comandos

Você quase não digita: a IA roda por você.

| Comando | O que faz | |
|---|---|---|
| [`reldor init`](./docs/init.pt-BR.md) | Configura o Reldor no projeto, perguntando só o que não detecta | ✅ |
| [`reldor status`](./docs/status.pt-BR.md) | Onde você está: branch, pendências, ambientes, spec, próximo passo | ✅ |
| [`reldor index`](./docs/index-command.pt-BR.md) | Monta o índice do projeto; só relê o que mudou | ✅ |
| [`reldor explain`](./docs/explain.pt-BR.md) | Engenharia reversa: automações na ordem de execução | ✅ |
| [`reldor usages`](./docs/usages.pt-BR.md) | Onde algo é usado, antes de alterar ou apagar | ✅ |
| `reldor log` | Tudo o que o Reldor fez, do mais recente ao mais antigo | ✅ |
| [`reldor refine`](./docs/refine.pt-BR.md) | Os fatos por trás da ideia de uma task: impacto, pontos de atenção, perguntas, tamanho | ✅ |
| [`reldor test-radar`](./docs/test-radar.pt-BR.md) | Testes que podem quebrar com as suas mudanças, e roda sem salvar | ✅ |
| [`reldor check`](./docs/check.pt-BR.md) | Campos lidos fora da query (SOQL ou selector) | ✅ |
| [`reldor security`](./docs/security.pt-BR.md) | Revisão de segurança das mudanças: SOQL injection, CRUD/FLS, sharing, logs sensíveis, segredos, XSS, flows, acesso de convidado | ✅ |
| [`reldor retrieve`](./docs/commit.pt-BR.md) | Retrieve com confirmação da org; tira a foto para o commit limpo | ✅ |
| [`reldor clean`](./docs/clean.pt-BR.md) | Antes do commit: deixa na pasta só o seu trabalho; o que veio da org vai para um stash | ✅ |
| [`reldor commit`](./docs/commit.pt-BR.md) | Commit limpo: só as suas linhas, até em arquivos que o retrieve também mudou | ✅ |
| [`reldor quality`](./docs/quality.pt-BR.md) | Código que a sua mudança repete (blocos, queries, métodos, textos) mais PMD e CPD | ✅ |
| [`reldor xml`](./docs/xml.pt-BR.md) | Ordena e remove duplicados em profiles, permission sets, labels, sharing rules, package.xml | ✅ |
| [`reldor hook install`](./docs/commit.pt-BR.md) | Gancho pre-commit, inclusive para commits feitos na mão | ✅ |
| [`reldor promote`](./docs/promote.pt-BR.md) | Ensaio de promoção: ordem dos commits, commits de outras pessoas, dependências faltando | ✅ |
| [`reldor merge`](./docs/merge.pt-BR.md) | Merge assistido na branch de merge: resolve os conflitos e confere se entrou só o seu | ✅ |
| [`reldor rollback`](./docs/rollback.pt-BR.md) | Plano de rollback de uma PR: revert, `destructiveChanges.xml`, riscos | ✅ |

### Skills

Todas as skills são **acionadas pela IA**: ela usa quando a conversa pede.

- **[reldor](./skills/reldor/SKILL.md)**: O roteador. Descobre onde você está e conduz o próximo passo.
- **[spec-review](./modules/sf/advisors/spec-review/SKILL.md)**: Aponta o que falta numa spec antes de ela rodar.
- **[automation-design](./modules/sf/advisors/automation-design/SKILL.md)**: Recomenda onde uma regra de negócio deve morar.
- **[lwc-ux](./modules/sf/advisors/lwc-ux/SKILL.md)**: Propõe telas LWC modernas e acessíveis antes de codar.
- **[task-refine](./modules/sf/advisors/task-refine/SKILL.md)**: Transforma a ideia numa task escrita com o impacto real: o que muda, perguntas em aberto, critérios de aceite e cenários de teste.

## Segurança

- Lê **apenas metadados**, nunca registros.
- Tokens e credenciais ficam **fora do repositório**.
- Toda ação fica num **histórico local** (`reldor log`).
- **Ações de Git desligadas por padrão**: o Reldor confere e avisa, e criar branch, commitar, fazer merge e abrir PR ficam com o seu fluxo (por exemplo, o plugin de fluxo do time). O `reldor init` pergunta; ligue só se vocês não tiverem uma ferramenta para isso.
- Deploy em produção **bloqueado por padrão**. Ações em quadros de tasks **desligadas por padrão**.
- Nada de cliente mora no Reldor: times, prefixos e orgs ficam num perfil dentro do repositório do próprio cliente.

## Como é construído

Um **núcleo** genérico e um **módulo** por tecnologia. Salesforce é o primeiro; mobile ou web podem vir depois sem mexer no núcleo. Detalhes na [arquitetura](./docs/architecture.pt-BR.md); os termos que usamos estão no [glossário](./GLOSSARY.md); as decisões, em [docs/adr](./docs/adr).

```
core/        cli, config, status, spec, git, log, report
modules/sf/  indexer, explain, checks, test-radar, refine, xml, security, quality, merge, promote, rollback, metadata, org, advisors
skills/      as instruções da IA, iguais no Kiro e no Claude Code
adapters/    manifestos finos por IDE
```

## Contribuindo

Leia o [AGENTS.md](./AGENTS.md) primeiro. Rode `npm test` antes de cada commit.

## Licença

Projeto privado. Todos os direitos reservados ao autor.
