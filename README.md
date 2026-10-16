# 🛡️ Reldor — o guardião do desenvolvimento

O Reldor ajuda times Salesforce a **escrever a task, desenvolver, testar e promover** com mais velocidade e menos erro.
Ele conhece a org por um índice montado por scripts e conversa pela IA que você já usa (Kiro ou Claude Code).

> **Status:** em planejamento. Este repositório contém a estrutura e a documentação; o código começa pela Fase 0.

---

## Por que existe

A IA lê o projeto e escreve código rápido, mas **nem sempre enxerga o contexto completo**: onde cada campo, método
ou automação é usado e o que uma mudança dispara. E o Git **não entende metadados Salesforce**, o que gera conflitos
falsos, commits sujos e promoções frágeis entre ambientes.

O Reldor resolve isso com uma regra simples: **scripts fazem o trabalho pesado e confiável; a IA só explica e conduz.**

---

## O que ele faz

### Antes da task
| Funcionalidade | O que faz |
|---|---|
| Refinador de task | Da ideia em texto livre: o que mudar, o que impacta, perguntas em aberto, critérios de aceite, tamanho |
| Engenharia reversa | "O que acontece quando uma Oportunidade é fechada?" com a cadeia real, na ordem de execução |
| Documentação de fluxo e roteiro de teste | Passo a passo de um processo, por record type, com o que validar |
| Onboarding | Explica um objeto ou área para quem acabou de chegar |

### Conselheiros, antes de executar
| Conselheiro | O que faz |
|---|---|
| Revisão de spec | Aponta lacunas (volume, registros existentes, critérios) e sugere o texto |
| Desenho de automação | Flow, trigger + handler, Queueable ou Batch, olhando o que já existe no objeto |
| LWC moderno | 2 ou 3 caminhos de tela com SLDS, estados, acessibilidade, cache, reuso e POC visual |
| "Quer que eu veja antes?" | Oferece essas revisões quando uma execução vai começar, sem bloquear |

### Durante o desenvolvimento
| Funcionalidade | O que faz |
|---|---|
| Contexto automático | Entrega à IA tudo que a mudança toca, com nota de risco |
| Radar de testes | Mudou VR, campo, RT, permissão, flow ou trigger? Aponta e roda os testes afetados |
| Checagem de queries | Campo usado e não consultado, campo apagado ainda referenciado, SOQL/DML em laço |
| Exclusão segura | Mostra todos os lugares que usam um método, classe, campo ou flow antes de apagar |
| Commit limpo | Só as suas linhas entram; o que veio da org fica de fora |
| Organizador de XML | Ordena e remove duplicados em profiles, permission sets, sharing rules, labels e outros |
| Org confirmada | Confirma a org antes de todo retrieve e deploy; produção bloqueada por padrão |

### Na promoção entre ambientes
| Funcionalidade | O que faz |
|---|---|
| Radar de colisão | Avisa que outra branch aberta mexe no mesmo arquivo |
| Ensaio de promoção | Conflitos, dependências faltando e commits fora de ordem, antes do PR |
| Merge inteligente | Resolve profiles e permission sets item a item, dentro do `git merge` |
| Rollback guiado | Plano completo para desfazer uma PR: revert, `destructiveChanges.xml`, riscos |
| Mapa de ambientes | Em quais ambientes cada feature já está |

A lista completa, com fases, está em [docs/roadmap.md](docs/roadmap.md).

---

## Como usar: sem decorar comandos

Você conversa com a IA. A skill do Reldor descobre em que etapa você está e conduz o próximo passo.

```
Você:   quero subir pra UAT
Reldor: 🛡️ Sua feature já está em develop. Fiz o ensaio para UAT:
        • 1 conflito em profile — resolvo item a item
        • o campo Account.Segmento__c não existe em UAT
        Quer ver o detalhe?
```

Outros exemplos:
- "o que acontece quando uma Oportunidade é fechada?"
- "quero criar uma task para bloquear o fechamento sem proposta aprovada"
- "vou apagar o método calcularScore"
- "preciso fazer rollback da PR 123"

Os comandos existem (`reldor status`, `reldor explain`…), mas **quem usa é a IA**. A lista está em
[docs/commands.md](docs/commands.md).

---

## Instalação (planejada)

Requisitos: **Node.js** (já vem com o Salesforce CLI), **Salesforce CLI `sf` v2** e **Git**.

```bash
# 1. instalar o núcleo
npm install -g reldor            # ou: baixar o release (.zip) e rodar install

# 2. dentro do projeto Salesforce
reldor init                      # detecta o projeto e pergunta só o que falta
```

Depois, instale a casca da sua IDE:
- **Kiro:** plugin em `adapters/kiro`
- **Claude Code:** plugin em `adapters/claude`

---

## Configuração

O Reldor funciona com valores padrão. O que é específico de cada empresa fica **no repositório do cliente**,
nunca no Reldor:

```
.reldor/
├─ reldor.config.yaml   ✅ versionado · ambientes, org de referência, módulos
├─ profile.md           ✅ versionado · framework, padrões, times, prefixos
├─ cache/               ❌ fora do Git · índice
├─ work/<task>/         ❌ fora do Git · contexto, snapshot do retrieve
└─ log/                 ❌ fora do Git · histórico de ações
```

Exemplo completo: [examples/reldor.config.yaml](examples/reldor.config.yaml).

---

## Arquitetura

**Núcleo genérico + módulos por tecnologia.** O núcleo não sabe nada de Salesforce; o módulo `sf` é o primeiro.

```
reldor/
├─ core/          núcleo: cli, config, status, spec, index, git, report, log
│                 (automations e connectors reservados)
├─ modules/sf/    módulo Salesforce: org, indexer, explain, refine, test-radar,
│                 checks, xml, merge, promote, rollback, frameworks, advisors
├─ skills/        o "cérebro": instruções para a IA (iguais no Kiro e no Claude)
├─ steering/      regras carregadas só quando fazem sentido (ex.: arquivos Apex)
├─ adapters/      cascas finas: kiro/ e claude/
└─ docs/
```

Detalhes em [docs/architecture.md](docs/architecture.md).

---

## Segurança

- Lê **apenas metadados**, nunca registros.
- Tokens e credenciais **fora do repositório**.
- Nenhum dado sai da máquina além do que a IDE já envia à IA.
- Toda ação fica registrada no **histórico local**.
- Ações sobre tasks (Monday, Azure DevOps, Jira) vêm **desligadas por padrão**.
- Produção **bloqueada por padrão** para deploy.

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Núcleo, módulos, índice, fluxo |
| [docs/commands.md](docs/commands.md) | Comandos que a IA usa |
| [docs/roadmap.md](docs/roadmap.md) | Fases e critérios |
| [skills/reldor/SKILL.md](skills/reldor/SKILL.md) | Como a IA conduz o Reldor |

---

## Licença

Projeto privado. Todos os direitos reservados ao autor.
