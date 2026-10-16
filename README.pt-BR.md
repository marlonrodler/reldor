<p align="center"><a href="./README.md">English</a> · <strong>Português</strong></p>

# 🛡️ Reldor: o guardião do desenvolvimento Salesforce

O guardião que lê a sua org antes de a sua IA escrever uma linha de código.

A IA já escreve código Salesforce rápido. O que ela não faz é enxergar a org inteira: o flow que roda antes da sua trigger, a validation rule que vai quebrar os testes de outros times, o roll-up que salva o registro pai junto. E o Git não entende metadados Salesforce: profiles dão conflito sem motivo e os commits levam tudo o que o último retrieve trouxe.

O Reldor resolve isso com uma regra: **scripts fazem o trabalho pesado e confiável; a IA só explica e conduz.** Ele monta um índice do projeto, segue a ordem de execução real e conversa com você pela IA que você já usa (Kiro ou Claude Code). Você não decora comandos: diz o que quer.

> **Status:** Fase 1 em andamento. `index`, `explain`, `usages`, `test-radar` e `check` já funcionam. Veja o [roadmap](./docs/roadmap.pt-BR.md).

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

### #2: Testes quebram de surpresa

**O problema.** Uma validation rule nova, um campo obrigatório ou uma permissão quebra testes de outros times. Ninguém percebe até a esteira falhar, horas depois.

**A solução.** O [`test-radar`](./docs/test-radar.pt-BR.md) aponta os testes que a sua mudança pode quebrar, diz por quê e roda na sandbox sem salvar nada. Ele também confere se todo campo lido no código está na query.

### #3: O Git não entende Salesforce

**O problema.** Duas pessoas adicionam classes diferentes no mesmo profile e o Git oferece "tudo ou nada". Um retrieve mistura a org com o seu trabalho. Uma promoção falha porque um campo só existe em develop.

**A solução.** Commit limpo, organizador de XML, merge que entende Salesforce e ensaio de promoção 🚧 (Fase 2).

### #4: Telas e automações no improviso

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
| `reldor refine` | Transforma a ideia da task em impacto, perguntas em aberto e critérios de aceite | 🚧 |
| [`reldor test-radar`](./docs/test-radar.pt-BR.md) | Testes que podem quebrar com as suas mudanças, e roda sem salvar | ✅ |
| [`reldor check`](./docs/check.pt-BR.md) | Campos lidos fora da query (SOQL ou selector) | ✅ |
| `reldor commit` · `xml` · `promote` · `rollback` | Commit limpo, organizador de XML, ensaio de promoção, plano de rollback | 🚧 |

### Skills

Todas as skills são **acionadas pela IA**: ela usa quando a conversa pede.

- **[reldor](./skills/reldor/SKILL.md)**: O roteador. Descobre onde você está e conduz o próximo passo.
- **[spec-review](./modules/sf/advisors/spec-review/SKILL.md)**: Aponta o que falta numa spec antes de ela rodar.
- **[automation-design](./modules/sf/advisors/automation-design/SKILL.md)**: Recomenda onde uma regra de negócio deve morar.
- **[lwc-ux](./modules/sf/advisors/lwc-ux/SKILL.md)**: Propõe telas LWC modernas e acessíveis antes de codar.

## Segurança

- Lê **apenas metadados**, nunca registros.
- Tokens e credenciais ficam **fora do repositório**.
- Toda ação fica num **histórico local** (`reldor log`).
- Deploy em produção **bloqueado por padrão**. Ações em quadros de tasks **desligadas por padrão**.
- Nada de cliente mora no Reldor: times, prefixos e orgs ficam num perfil dentro do repositório do próprio cliente.

## Como é construído

Um **núcleo** genérico e um **módulo** por tecnologia. Salesforce é o primeiro; mobile ou web podem vir depois sem mexer no núcleo. Detalhes na [arquitetura](./docs/architecture.pt-BR.md); os termos que usamos estão no [glossário](./GLOSSARY.md); as decisões, em [docs/adr](./docs/adr).

```
core/        cli, config, status, spec, git, log, report
modules/sf/  indexer, explain, checks, test-radar, org, advisors (+ planejados: xml, merge, promote, rollback)
skills/      as instruções da IA, iguais no Kiro e no Claude Code
adapters/    manifestos finos por IDE
```

## Contribuindo

Leia o [AGENTS.md](./AGENTS.md) primeiro. Rode `npm test` antes de cada commit.

## Licença

Projeto privado. Todos os direitos reservados ao autor.
