<p align="center"><strong>Português</strong> · <a href="./architecture.en.md">English</a></p>

# Arquitetura

## A ideia em uma frase
O **núcleo** não sabe nada de Salesforce. Ele pede aos **módulos**: "detecte", "indexe", "explique", "verifique".
O módulo `sf` é o primeiro (e hoje o único) a responder. Um módulo futuro (mobile, web) responderia aos mesmos pedidos,
sem mudar o núcleo.

## Como uma pergunta vira resposta

```text
Você fala → a IA (skill do Reldor) → roda o comando reldor → scripts leem o índice do projeto
         ← a IA explica o resultado ← o comando devolve fatos (JSON)
```

Três regras sustentam isso:
1. **Quem descobre os fatos é o script, nunca a IA.** A cadeia de automações, as referências e os conflitos são
   calculados por código, então são repetíveis e confiáveis. A IA só interpreta o pedido e explica o resultado.
2. **O Reldor só lê metadados**, nunca registros.
3. **O que é da empresa fica no `.reldor/` do repositório dela**, nunca no Reldor.

## Três camadas

| Camada | O que é | Gasta tokens? |
|---|---|---|
| **Comando `reldor`** (Node.js) | Scripts: índice, Git, org, XML, testes | Não |
| **Skills** (`SKILL.md`) | Ensinam a IA a escolher o comando e explicar o resultado | Sim, pouco |
| **Manifestos** (Kiro, Claude Code) | Dizem a cada IDE quais skills existem | Não |

As skills são escritas uma vez e servem nas duas IDEs. A IA usa uma skill quando a conversa pede: a descrição da skill
diz quando. Não há ganchos de IDE nem regras sempre ativas; o único gancho é o pre-commit do Git, que você instala se
quiser (`reldor hook install`).

## Um índice, vários usos

O índice é um **sumário** do projeto (nomes e ligações, nunca registros):

- por objeto: campos, validation rules, flows (tipo e critério de entrada), triggers, record types, roll-ups,
  bypass (custom settings e custom metadata);
- quem faz DML em qual objeto e quais campos cada classe usa;
- cadeia do fflib, resolvida a partir da classe `Application`, e handlers no estilo TriggerHandler;
- referências cruzadas (quem usa cada método, campo, classe e flow).

Ele alimenta: `explain`, `usages`, `refine`, `test-radar`, `check`, `review`, `promote` e `rollback`.

Atualização: a cada comando, o índice relê só os arquivos que mudaram (tamanho ou data). `reldor index --full` refaz
tudo. Fica em `.reldor/cache/` (fora do Git). Ele se refaz sozinho quando o código do indexador muda.

## Convive com as ferramentas do time
Cada módulo lista suas **capacidades** (ordenar XML, remover duplicados, rodar o Code Analyzer, rodar testes...). O
projeto diz em `tools:` quando outra ferramenta já faz uma delas: `run` (o Reldor faz), `verify` (o Reldor só confere)
ou `skip` (o Reldor fica de fora). O `reldor tools` procura sinais dessas ferramentas (ganchos de Git, esteira,
instruções da IA, scripts do `package.json`) e sugere; a decisão é sempre da pessoa. Veja o [`tools`](./tools.md) e a
[ADR 0004](./adr/0004-team-tools.md).

E nada roda duas vezes: um **registro de execuções** guarda o resultado de cada checagem pelo conteúdo do que ela lê.
O gancho, o `review` e a IA, pedindo a mesma checagem sobre o mesmo conteúdo, compartilham o resultado.

## Specs
O Reldor procura specs em `.kiro/specs` e em `spec.path` da configuração (pastas com `requirements.md`, `design.md` ou
`tasks.md`) e liga a spec à branch pelo nome. Ele não gera specs: se não houver nenhuma, a IA pede a task ou a
descrição. Nunca inventa.

## Git e promoção
- **Commit limpo:** foto (snapshot) depois do retrieve; no commit, entra só a diferença "foto → agora", linha a linha.
- **Merge de metadado item a item:** um merge driver para profiles, permission sets, labels e afins, instalado em
  `.git/info/attributes` (só na sua máquina, sem alterar o repositório).
- **Merge assistido:** faz o `git merge` na branch de merge, resolve conflitos mantendo o destino e aplicando só a sua
  mudança, e confere se entrou só o seu. O `git merge` e o commit de merge, você roda; o Reldor resolve os arquivos com confirmação.
- **Ensaio de promoção:** simula o merge sem mudar nada; checa dependências e a ordem dos commits.
- A cadeia de ambientes vem da configuração (ex.: develop → uat → producao), sem nada fixo no código.
- **O Reldor não executa Git nem org:** não commita, não faz merge nem checkout e não roda nada na org
  (retrieve, testes, deploy). Ele confere e entrega os comandos (`handover` em `core/report`). Mudanças só nos arquivos pedem
  confirmação (`core/cli/confirm.js`); sem terminal e sem `--yes`, a resposta é não.

## Pastas do repositório

```
core/
├─ cli/           entrada dos comandos
├─ config/        lê a configuração, valores padrão
├─ status/        descobre a etapa atual (usado pela IA)
├─ doctor/        confere a instalação e a pasta do terminal
├─ profile/       o profile.md: a parte lida do projeto e a parte do time
├─ tools/         ferramentas do time: quem cuida de cada capacidade
├─ runs/          registro de execuções (a mesma checagem não roda duas vezes)
├─ spec/          encontra specs
├─ modules/       carrega os módulos (contrato abaixo)
├─ util/          execução de comandos (compatível com Windows)
├─ git/           snapshot, commit limpo, ordem dos commits
├─ report/        saída no terminal e os comandos entregues à pessoa
└─ log/           histórico de ações
modules/sf/
├─ org/           confirmar a org, retrieve, rodar testes, proteção de produção
├─ indexer/       force-app → índice (parsers, cache incremental, cadeia do fflib)
├─ explain/       engenharia reversa e roteiros de teste
├─ checks/        onde é usado, campos dinâmicos, campo fora da query
├─ refine/        refinador de task
├─ test-radar/    testes afetados por uma mudança
├─ security/      revisão de segurança (regras próprias + Code Analyzer)
├─ quality/       código repetido (regras próprias + PMD e CPD)
├─ xml/           organizador de XML (regras por tipo)
├─ merge/         merge item a item e merge assistido
├─ promote/       ensaio de promoção e radar de colisão
├─ rollback/      plano de rollback
├─ metadata/      tipos de metadado por caminho
├─ tools.js       capacidades do módulo e detecção das ferramentas do time
└─ advisors/      conselheiros (skills): task-refine, automation-design, lwc-ux
```

## Contrato de um módulo
`name`, `label`, `matches(root)`, `detect(root)`, `statusLines(facts)`, `profileLines(facts)` e, opcionais,
`alerts(...)` (avisos do `status`), `doctorChecks(root)` (o que o `doctor` confere), `capabilities` e
`detectTools(root)` (o que o `tools` mostra).

## Conselheiros
Cada conselheiro é **uma skill**, sem código no núcleo. A IA usa quando a conversa pede (criar uma automação, uma tela,
revisar uma spec, escrever uma task), e o conselheiro roda os comandos do Reldor para ter os fatos. Novos conselheiros
entram como novas pastas em `advisors/`.

## Projeto do cliente

```
.reldor/
├─ reldor.config.yaml   ✅ Git (ambientes, ferramentas do time, regras)
├─ profile.md           ✅ Git (lido do projeto pelo reldor profile + padrões escritos pelo time)
├─ cache/               ❌ fora (índice, registro de execuções)
├─ work/                ❌ fora
└─ log/                 ❌ fora
```
