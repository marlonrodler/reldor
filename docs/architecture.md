# Arquitetura

## A ideia em uma frase
O **núcleo** não sabe nada de Salesforce. Ele pede aos **módulos**: "detecte", "indexe", "explique", "verifique".
O módulo `sf` é o primeiro a responder. Um módulo futuro (mobile, web) responde aos mesmos pedidos, sem mudar o núcleo.

## Três camadas

| Camada | O que é | Gasta tokens? |
|---|---|---|
| **Núcleo `reldor`** (Node.js) | Scripts: índice, Git, org, XML, testes | Não |
| **Skills** (`SKILL.md`) | Ensinam a IA a conduzir e explicar | Sim, pouco |
| **Cascas** (Kiro, Claude Code) | Manifesto + hooks de cada IDE | Não |

As skills são escritas uma vez e servem nas duas IDEs. As cascas são finas porque os formatos das IDEs mudam.

## Um índice, vários usos

O índice é um **sumário** da org (nomes e ligações, nunca código nem registros):

- por objeto: campos, validation rules, flows (tipo e critério de entrada), triggers, record types, roll-ups,
  bypass (custom settings e custom metadata), pacotes gerenciados;
- quem faz DML em qual objeto e quais campos cada classe usa;
- cadeia fflib, resolvida a partir da classe `Application`;
- referências cruzadas (quem usa cada método, campo, classe e flow).

Ele alimenta: refinador, engenharia reversa, contexto da IA, radar de testes, checagem de queries,
exclusão segura, ensaio de promoção e rollback.

Atualização: após cada retrieve e a cada 24h (configurável), só o que mudou.

## Onde a IA entra
Só para **interpretar** (ler a task ou a spec) e **explicar** (escrever o resultado em português).
A cadeia de automações, as referências e os conflitos são calculados por script, por isso são confiáveis e repetíveis.

## Origem da spec
1. **Detecta** uma spec existente (Kiro ou outro gerador de specs).
2. **Configurada:** roda o gerador que a equipe informou.
3. Se não houver nada, **pede a task ou a descrição**. Nunca inventa.

## Git e promoção
- **Commit limpo:** foto (snapshot) a cada retrieve; no commit, entra só a diferença "foto → agora".
- **Merge inteligente:** merge driver por item (permissão, campo, label), instalado em `.git/info/attributes`,
  sem alterar o repositório e sem criar commits.
- **Ensaio de promoção:** simula o merge numa pasta separada; checa dependências e a ordem dos commits.
- A cadeia de ambientes vem da configuração (ex.: develop → uat → producao), sem nada fixo no código.

## Pastas do repositório

```
core/
├─ cli/           entrada dos comandos
├─ config/        lê config + perfil, valores padrão
├─ status/        descobre a etapa atual (usado pela IA)
├─ spec/          origem da spec
├─ index/         formato, cache, atualização incremental
├─ git/           snapshot, commit limpo, pre-commit, ordem dos commits
├─ report/        modelos de saída (tom de guardião, idioma configurável)
├─ log/           histórico de ações
├─ automations/   (reservado) QUANDO / SE / FAÇA
└─ connectors/    (reservado) Monday, Azure DevOps, Jira
modules/sf/
├─ org/           confirmar org, retrieve, deploy, bloqueio de produção
├─ indexer/       force-app → índice
├─ explain/       engenharia reversa e roteiros de teste
├─ refine/        refinador de task
├─ test-radar/    testes afetados por uma mudança
├─ checks/        queries, limites, exclusão segura
├─ xml/           organizador de XML (regras por tipo)
├─ merge/         merge driver por item
├─ promote/       ensaio de promoção, mapa de ambientes
├─ rollback/      plano de rollback
├─ frameworks/    fflib, trigger handler genérico
└─ advisors/      conselheiros (skills): spec-review, automation-design, lwc-ux
```

## Conselheiros
Cada conselheiro é **uma skill**, sem código no núcleo. Novos conselheiros (integração, segurança) entram como
novas pastas em `advisors/`.

O "quer que eu veja isso antes?" usa uma regra de steering sempre ativa e hooks do Kiro e do Claude, que disparam
quando uma spec é criada ou uma execução começa. Ele só pergunta quando encontra algo relevante, e tem os modos
`off`, `ask` e `auto`.

## Projeto do cliente

```
.reldor/
├─ reldor.config.yaml   ✅ Git
├─ profile.md           ✅ Git
├─ cache/               ❌ fora
├─ work/<task>/         ❌ fora
└─ log/                 ❌ fora
```
