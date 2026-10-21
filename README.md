<p align="center"><strong>Português</strong> · <a href="./README.en.md">English</a></p>

# 🛡️ Reldor: o guardião do desenvolvimento Salesforce

O guardião que lê a sua org antes de a sua IA escrever uma linha de código.

**Em um minuto:** a IA escreve código Salesforce rápido, mas não enxerga a org inteira (o flow que roda antes da sua trigger, a validation rule que quebra os testes de outro time, o roll-up que salva o pai junto), e o Git compara linhas, não itens de metadado (dois devs mexendo no mesmo profile viram conflito; o commit leva tudo o que o retrieve trouxe). O Reldor é um comando que monta um índice do seu projeto e calcula esses fatos com scripts, e um plugin que ensina a sua IA (Kiro ou Claude Code) a usar esse comando. **Você conversa; a IA roda o Reldor e explica o resultado.** E ele convive com as ferramentas que o time já usa: o que outra ferramenta faz, ele só confere ou deixa com ela, sem repetir.

### Como funciona

```text
Você fala → a IA (skill do Reldor) → roda o comando reldor → scripts leem o índice do projeto
         ← a IA explica o resultado ← o comando devolve fatos (JSON)
```

1. **Quem descobre os fatos é o script, nunca a IA.** Por isso as respostas são repetíveis.
2. **O Reldor só lê metadados**, nunca registros, e roda na sua máquina.
3. **O que é da empresa fica no `.reldor/` do repositório dela**: ambientes, padrões e as ferramentas do time.

> **Status:** as funcionalidades das Fases 1 e 2 estão prontas no código e testadas em 16 projetos Salesforce públicos. Falta a validação em uso real (Fase 3). Veja o [roadmap](./docs/roadmap.md).

**Nesta página:** [Como funciona](#como-funciona) · [Instalação](#instalação) · [O dia a dia](#o-dia-a-dia) · [Por que o Reldor existe](#por-que-o-reldor-existe) · [Referência](#referência) · [Segurança](#segurança) · [Licença](#licença)

## Instalação

São três peças. As duas primeiras você instala **uma vez** no computador; a terceira aparece sozinha em cada projeto.

```text
Seu computador
├─ comando reldor ............ passo 2: o motor (npm ou git clone)
├─ plugin na IA .............. passo 3: ensina o Kiro ou o Claude Code a usar o comando
└─ C:\...\projeto-salesforce . o projeto do time (tem o sfdx-project.json)
   └─ .reldor\ ............... passo 5: criada aqui, com as configurações do projeto
```

O Reldor **não fica dentro do projeto do time**: do projeto, só a pasta `.reldor/` é dele.

### 1. Confira o que você precisa

Abra um terminal (no Windows, o **PowerShell**; o terminal do VS Code também serve) e rode:

```bash
node --version   # Node.js 18 ou mais novo
git --version    # Git
sf --version     # Salesforce CLI (sf v2)
```

Se algum comando der erro, instale e depois **feche e abra o terminal**:

| Ferramenta | Windows (PowerShell) | Mac | Outros jeitos |
|---|---|---|---|
| **Node.js** (LTS, 18+) | `winget install OpenJS.NodeJS.LTS` | `brew install node` | [nodejs.org](https://nodejs.org) |
| **Git** | `winget install Git.Git` | `brew install git` | [git-scm.com](https://git-scm.com/downloads) |
| **Salesforce CLI** | `npm install --global @salesforce/cli` | `npm install --global @salesforce/cli` | [instalador](https://developer.salesforce.com/tools/salesforcecli) |

> O instalador do Salesforce CLI traz o próprio Node.js, mas não deixa o `node` disponível no terminal. O Reldor precisa do Node.js instalado à parte.

Opcionais: o **Salesforce Code Analyzer** soma as regras oficiais (PMD, CPD, segurança) ao `review` (`sf plugins install code-analyzer`, precisa de Java 11+), e o **GitHub CLI** deixa o Reldor ler as pull requests abertas (`winget install GitHub.cli`, depois `gh auth login`).

### 2. Instale o comando `reldor`

Escolha **um** dos dois jeitos. Na dúvida, use o A.

**A. Pelo npm (recomendado).** Uma linha, em qualquer pasta. O npm guarda o Reldor junto com os outros comandos globais e você não precisa escolher pasta.

```bash
npm install -g github:marlonrodler/reldor
reldor --version
```

**B. Pelo git clone.** Você fica com a pasta do Reldor no computador, para ler o código ou instalar o plugin do Kiro por pasta. Escolha uma pasta de ferramentas **fora dos projetos e fora do OneDrive** (a sincronização deixa tudo lento):

```powershell
mkdir C:\Users\$env:USERNAME\ferramentas
cd C:\Users\$env:USERNAME\ferramentas
git clone https://github.com/marlonrodler/reldor.git
cd reldor
npm install
npm install -g .
reldor --version
```

O `npm install -g .` liga o comando `reldor` a essa pasta: depois disso, **não mova nem apague a pasta**.

Nos dois jeitos, se aparecer o número da versão, deu certo.

| | A. npm | B. git clone |
|---|---|---|
| **Atualizar** | `npm install -g github:marlonrodler/reldor` | na pasta do Reldor: `git pull` e `npm install` |
| **Desinstalar** | `npm uninstall -g reldor` | `npm uninstall -g reldor` e apague a pasta |

### 3. Ligue o Reldor na sua IA

**Kiro**
1. Clique no ícone do **fantasminha com raio** ⚡ na barra da esquerda. Abre o painel **Powers**.
2. Clique em **Add Custom Power** → **Import power from GitHub**.
3. Cole o link abaixo e clique em **Install**:
   ```
   https://github.com/marlonrodler/reldor/tree/main/plugins/kiro/reldor
   ```

👉 Cada clique explicado, como instalar pela pasta (se você usou o git clone), como atualizar e como conferir: [Ligar o Reldor no Kiro](./docs/kiro.md).

**Claude Code**, num terminal:

```bash
claude plugin marketplace add marlonrodler/reldor
claude plugin install reldor@reldor
```

**Sem IA:** tudo funciona como comando no terminal. `reldor help` mostra a lista.

### 4. Confira, de dentro do projeto

1. No VS Code, **File → Open Folder** e escolha a pasta do projeto Salesforce (a que tem o `sfdx-project.json`).
2. **Terminal → New Terminal**. O terminal já abre na pasta do projeto.
3. Rode:

```bash
reldor doctor
```

Ele confere o que está instalado, se o terminal está na pasta certa e se o plugin está na IA, e termina com **um** próximo passo. Se algo faltar, ele mostra o comando que resolve. Veja o [`doctor`](./docs/doctor.md).

### 5. Diga oi para a IA, nesse projeto

Com o projeto aberto, abra um **chat novo** da sua IA e diga:

> quero usar o Reldor

A partir daqui a IA roda os comandos que **leem** e explica o resultado. Na primeira vez ela roda o [`reldor init`](./docs/init.md), que não pergunta nada: detecta o projeto e cria a pasta `.reldor/` **nesse projeto**, com a configuração (só o que foi detectado) e o `profile.md` (o que o Reldor leu do projeto: classes, triggers, fflib, nomes, mais uma parte para o time escrever os próprios padrões). Commite essa pasta, ela vale para o time todo. Branches dos ambientes e org só são pedidas quando um comando precisa delas; para deixar anotado, use o [`reldor env`](./docs/env.md).

O que mexe no Git ou na org (commit, stash, merge, retrieve, testes, deploy) **o Reldor não executa**: ele confere e mostra os comandos prontos, e quem roda é você ou a sua ferramenta. Mudanças só nos arquivos (organizar um XML, instalar o gancho) pedem a sua confirmação antes.

<details>
<summary><b>Deu problema?</b></summary>

- **"reldor não é reconhecido como comando"**: feche e abra o terminal (ou o VS Code inteiro). Se continuar, confira se está instalado com `npm ls -g reldor`. Se estiver, falta a pasta do npm no PATH da sua conta. Para colocar, no **Prompt de Comando (cmd)**:
  1. `npm prefix -g` mostra a pasta (algo como `C:\Users\<você>\AppData\Roaming\npm`);
  2. `reg query HKCU\Environment /v Path` mostra o PATH da sua conta;
  3. `setx PATH "<o valor do passo 2>;<a pasta do passo 1>"` (se o passo 2 disser que não existe valor, só `setx PATH "<a pasta do passo 1>"`). Não use `%PATH%` aqui: ele copia o PATH do sistema para a sua conta;
  4. feche e abra o terminal.
  Ou pela tela: menu Iniciar → "Editar as variáveis de ambiente para sua conta" → Path → Novo.
- **"a execução de scripts foi desabilitada neste sistema"** ou **"modo de linguagem"** (PowerShell restrito pela TI): use `reldor.cmd doctor` no lugar de `reldor doctor`, ou rode no Prompt de Comando (cmd). Mudar a política do PowerShell é decisão da sua equipe de TI.
- **O `doctor` diz que é a pasta do próprio Reldor, ou que não achou o projeto**: o terminal está na pasta errada. Abra a pasta do projeto no VS Code e abra um terminal novo.
- **No chat da IA, o comando roda mas a resposta não aparece** (alguns terminais de IA no Windows perdem a saída): a skill já sabe pedir o resultado num arquivo com `--out` (ex.: `reldor status --json --out .reldor/work/status.json`). Você também pode usar isso no terminal.
- **A IA diz que não conhece o Reldor**: o plugin não está instalado (passo 3) ou o chat foi aberto antes da instalação. Abra um chat novo.
- **O `npm install` avisou de vulnerabilidades**: atualize o Reldor (tabela do passo 2). Não rode `npm audit fix --force` por conta própria.

</details>

## O dia a dia

Você não decora comandos: diz o que quer e a IA roda o certo.

| Momento | O que você diz | O que o Reldor faz |
|---|---|---|
| **E agora?** | "e agora?" | [`status`](./docs/status.md): onde você está, avisos se subir agora, próximo passo |
| **Tarefa** | "vamos na tarefa 1234" | [`task`](./docs/task.md): acha a tarefa pela branch e a spec dela em qualquer ferramenta, diz a fase, e não mistura uma tarefa com outra |
| **Refinar** | "me ajuda a escrever a task", "revisa a spec" | [`refine`](./docs/refine.md) com o conselheiro [task-refine](./docs/advisors/task-refine.md): deixa a task no padrão, busca só o que ela pede, diz o que já existe para reusar, o que falta liberar e os limites |
| **Entender** | "o que acontece quando uma Oportunidade é fechada?", "onde isso é usado?" | [`explain`](./docs/explain.md), [`usages`](./docs/usages.md) e os conselheiros |
| **Liberar** | "esse valor já existe?", "o campo não aparece" | [`access`](./docs/access.md): o que já está e onde falta liberar (record type, layout, acesso, path, tradução, regras) |
| **Criar** | "já existe um método para isso?" | [`helpers`](./docs/helpers.md): o que já existe, compartilhado primeiro; se não existir, a IA propõe um método genérico que todo time possa usar |
| **Revisar** | "posso commitar?" | [`review`](./docs/review.md): segurança, qualidade e código repetido, campo fora da query, testes que podem quebrar e XML, num resumo só |
| **Commitar** | "vou commitar, tira o que não é meu" | [`commit`](./docs/commit.md): separa o seu do que veio da org e mostra os comandos (só as suas linhas no commit, ou `--stash-org` para deixar na pasta só o seu) |
| **Merge** | "faz o merge da minha branch" (na branch de merge) | [`merge`](./docs/merge.md): confere antes, mostra o `git merge` para você rodar, resolve os conflitos dos arquivos mantendo o destino e aplicando só a sua mudança, e confere se entrou só o seu |
| **Subir** | "está pronto para o pré-UAT?" | [`promote`](./docs/promote.md): ordem dos commits e dependências faltando antes da PR |
| **Deploy** | "monta o deploy para a minha sandbox" | [`deploy`](./docs/deploy.md): os comandos de validação e de deploy dos seus arquivos, com os testes do radar; quem roda é você |
| **Desfazer** | "preciso fazer rollback da PR 123" | [`rollback`](./docs/rollback.md): revert, `destructiveChanges.xml` e riscos |

Depois de instalado (`reldor hook install`), um gancho pre-commit roda em todo commit, inclusive nos feitos por outras ferramentas.

**Começando?** Na primeira semana, use só os momentos que leem (E agora?, Entender, Revisar): eles não mudam nada. Nos outros (Commitar, Merge, Deploy), o Reldor confere e entrega os comandos; você decide se e quando rodar.

## Por que o Reldor existe

### #1: A IA não enxerga a org inteira

**O problema.** A IA lê os arquivos que você mostra. Ela não sabe que um flow before-save já preenche aquele campo, que uma workflow rule faz suas triggers de update rodarem de novo, ou que salvar um registro filho recalcula e salva o pai. Você descobre em UAT.

**A solução.** Um índice montado por scripts, não adivinhado pela IA:

- [`explain`](./docs/explain.md): o que acontece quando um registro é salvo, na ordem de execução real, seguindo a cadeia do fflib pela sua classe `Application`.
- [`usages`](./docs/usages.md): todos os lugares onde um campo, classe, método, flow ou objeto é usado, com o grau de certeza.
- [`refine`](./docs/refine.md): antes mesmo de a task ser escrita, o que ela toca e o que perguntar.

### #2: Testes quebram de surpresa

**O problema.** Uma validation rule nova, um campo obrigatório ou uma permissão quebra testes de outros times. Ninguém percebe até a esteira falhar, horas depois.

**A solução.** O [`test-radar`](./docs/test-radar.md) aponta os testes que a sua mudança pode quebrar, diz por quê e roda na sandbox sem salvar nada. Ele também confere se todo campo lido no código está na query.

### #3: O Git compara linhas; o Salesforce pensa em itens

**O problema.** Num profile ou permission set, cada permissão é um item, e os itens ficam em ordem alfabética. Quando duas pessoas acrescentam permissões vizinhas, o Git vê as mesmas linhas mudando dos dois lados e para com conflito, e quem resolve na mão costuma ficar com um lado só. Itens duplicados que passam despercebidos fazem o deploy falhar.

**A solução.** Um [merge item a item](./docs/promote.md#merge-inteligente) dentro do `git merge` normal, que só deixa conflito quando os dois lados mudaram o mesmo item. Um [merge assistido](./docs/merge.md) na branch de merge, que mantém o destino, aplica só a sua mudança e confere se **entrou só o seu**. E um [organizador de XML](./docs/xml.md) que ordena e tira duplicados como o Salesforce faz.

### #4: O retrieve e a promoção misturam trabalhos

**O problema.** Um retrieve mistura a org com o seu trabalho, e o commit leva tudo. Uma promoção falha porque um campo só existe em develop, ou porque um commit não passou pelo ambiente anterior.

**A solução.** O [commit limpo](./docs/commit.md) separa o seu trabalho do que veio da org e entrega os comandos para levar só as suas linhas, ou, com `--stash-org`, para deixar na pasta só o seu antes de qualquer ferramenta commitar. Um [ensaio de promoção](./docs/promote.md) acha commits fora de ordem e dependências faltando antes da pull request. E um [plano de rollback](./docs/rollback.md) traz o revert, o `destructiveChanges.xml` e os riscos.

### #5: Brechas de segurança e código copiado que ninguém viu

**O problema.** Um método de tela que lê dados sem checar permissão, uma query montada concatenando o que o usuário digitou, um `System.debug` com CPF, uma classe que ignora o compartilhamento a três chamadas da tela. Num banco, qualquer uma dessas vira incidente.

**A solução.** O [`security`](./docs/security.md) revisa as suas mudanças antes do commit: regras do próprio Reldor e, quando instalado, o Salesforce Code Analyzer oficial. Ele também segue o **caminho**: da tela ou da API até uma classe `without sharing` que mexe em dados, algo que um scanner arquivo por arquivo não enxerga.

O [`quality`](./docs/quality.md) pega a cópia antes de ela se espalhar: um bloco colado de outra classe, uma query que já mora num Selector, um método que já existe. Só a repetição que a sua mudança cria, mais o PMD e o CPD do Code Analyzer.

### #6: Telas e automações no improviso

**O problema.** A IA já sai codando: mais uma trigger num objeto que já tem uma, `@future` onde cabe Queueable, tela feita com HTML na mão.

**A solução.** Conselheiros que entram **antes** do código, com uma pergunta e sem bloquear nada:

- [automation-design](./docs/advisors/automation-design.md): onde a lógica deve morar (flow, trigger, Queueable, Batch), olhando o que já existe.
- [lwc-ux](./docs/advisors/lwc-ux.md): dois ou três caminhos de tela modernos com SLDS, mais uma POC descartável.

### #7: Ferramentas que fazem a mesma coisa

**O problema.** O time já tem um plugin que organiza profiles, uma esteira que roda o Code Analyzer e os testes, um gancho de commit. Uma ferramenta nova que faz tudo de novo gasta tempo, e duas ferramentas reescrevendo o mesmo arquivo brigam.

**A solução.** O [`tools`](./docs/tools.md) acha sinais dessas ferramentas no projeto e pergunta quem cuida de cada coisa. O que outra ferramenta faz, o Reldor só confere (sem refazer) ou deixa com ela, e diz isso no resultado. E nada roda duas vezes: a mesma checagem sobre o mesmo conteúdo é reaproveitada.

### #8: Task mal escrita, campo duplicado e limite estourado

**O problema.** A task chega solta ("criar o campo X", "incluir o valor Y"), e cada palavra vira uma busca. O campo pedido muitas vezes já existe com outro nome, em outro time; o valor já existe, mas não foi liberado no record type. Cada time cria a sua cópia, o objeto se aproxima do limite de campos, e trocar nomes numa org grande quebra relatórios e integrações.

**A solução.** O [`task`](./docs/task.md) descobre sozinho em que tarefa você está (pela branch) e acha a spec dela em qualquer ferramenta, sem misturar uma tarefa com outra. O [refinamento em etapas](./docs/refine.md) deixa a task num padrão leve e busca só o que ela pede. Antes de criar, mostra o que já existe e de quem é: reusar como está, criar uma versão genérica que todo time possa usar, ou criar novo, sem nunca renomear o que existe. O [`access`](./docs/access.md) mostra onde falta liberar, e o [`limits`](./docs/limits.md) avisa quando o objeto está perto de um limite.

## Referência

### Todos os comandos

As peças por trás dos momentos. A IA escolhe; você pode rodar qualquer um no terminal.

| Comando | O que faz | |
|---|---|---|
| [`reldor env`](./docs/env.md) | A cadeia de ambientes e os nomes de branch: ver e mudar, nada fixo no código | ✅ |
| [`reldor review`](./docs/review.md) | Revisão antes do commit: segurança, qualidade, queries, testes e XML de uma vez | ✅ |
| [`reldor tools`](./docs/tools.md) | Ferramentas do time: quem cuida de cada coisa, para o Reldor só conferir ou ficar de fora | ✅ |
| [`reldor doctor`](./docs/doctor.md) | Confere a instalação e a pasta do terminal, e diz o próximo passo | ✅ |
| [`reldor init`](./docs/init.md) | Configura o Reldor no projeto sem perguntar nada: grava só o que detectou | ✅ |
| [`reldor profile`](./docs/init.md#o-profilemd) | Atualiza o `profile.md` com o que está no projeto hoje, sem mexer na parte do time | ✅ |
| [`reldor status`](./docs/status.md) | Onde você está: tarefa, branch, pendências, ambientes, spec, próximo passo | ✅ |
| [`reldor task`](./docs/task.md) | A tarefa atual: número pela branch, spec em qualquer ferramenta, fase, pasta por tarefa; onde guardar a task refinada | ✅ |
| [`reldor limits`](./docs/limits.md) | Limites por objeto contados pelo projeto (campos, relacionamentos, roll-ups, regras); `--org` lê os limites da org | ✅ |
| [`reldor index`](./docs/index-command.md) | Monta o índice do projeto; só relê o que mudou | ✅ |
| [`reldor explain`](./docs/explain.md) | Engenharia reversa: automações na ordem de execução | ✅ |
| [`reldor usages`](./docs/usages.md) | Onde algo é usado, antes de alterar ou apagar | ✅ |
| [`reldor helpers`](./docs/helpers.md) | Antes de criar um método: o que já existe (compartilhado primeiro) e métodos iguais em times diferentes | ✅ |
| [`reldor me`](./docs/helpers.md) | O seu time e o prefixo dele, só na sua máquina | ✅ |
| `reldor log` | Tudo o que o Reldor fez, do mais recente ao mais antigo | ✅ |
| [`reldor refine`](./docs/refine.md) | Os fatos de uma task: com a task no padrão, busca só os alvos, o que reusar, o que liberar e os limites (`--file`) | ✅ |
| [`reldor access`](./docs/access.md) | Já existe, mas está liberado? Onde falta liberar um valor de picklist, campo, objeto ou classe: record type, layout, FLS, path, tradução, regras | ✅ |
| [`reldor test-radar`](./docs/test-radar.md) | Testes que podem quebrar com as suas mudanças; monta o comando de validação e lê o resultado (`--result`) | ✅ |
| [`reldor check`](./docs/check.md) | Campos lidos fora da query (SOQL ou selector) | ✅ |
| [`reldor security`](./docs/security.md) | Revisão de segurança das mudanças: SOQL injection, CRUD/FLS, sharing, logs sensíveis, segredos, XSS, flows, acesso de convidado | ✅ |
| [`reldor retrieve`](./docs/commit.md) | Monta o comando de retrieve da org certa e tira a foto para o commit limpo | ✅ |
| [`reldor commit`](./docs/commit.md) | Commit limpo: prepara só as suas linhas, até em arquivos que o retrieve também mudou, e entrega os comandos (`--stash-org` deixa na pasta só o seu; `reldor clean` é o nome curto) | ✅ |
| [`reldor deploy`](./docs/deploy.md) | Monta os comandos de validação e de deploy dos seus arquivos, com os testes do radar; nunca executa | ✅ |
| [`reldor quality`](./docs/quality.md) | Código que a sua mudança repete (blocos, queries, métodos, textos) mais PMD e CPD | ✅ |
| [`reldor xml`](./docs/xml.md) | Ordena e remove duplicados em profiles, permission sets, labels, sharing rules, package.xml | ✅ |
| [`reldor hook install`](./docs/commit.md) | Gancho pre-commit, inclusive para commits feitos na mão | ✅ |
| [`reldor promote`](./docs/promote.md) | Ensaio de promoção: ordem dos commits, commits de outras pessoas, dependências faltando | ✅ |
| [`reldor merge`](./docs/merge.md) | Merge assistido na branch de merge: confere, entrega o `git merge`, resolve os conflitos nos arquivos e confere se entrou só o seu | ✅ |
| [`reldor rollback`](./docs/rollback.md) | Plano de rollback de uma PR: revert, `destructiveChanges.xml`, riscos | ✅ |

### Skills (para a IA)

Todas as skills são **acionadas pela IA**: ela usa quando a conversa pede.

- **[reldor](./skills/reldor/SKILL.md)**: O roteador. Descobre onde você está e conduz o próximo passo.
- **[automation-design](./modules/sf/advisors/automation-design/SKILL.md)**: Recomenda onde uma regra de negócio deve morar.
- **[lwc-ux](./modules/sf/advisors/lwc-ux/SKILL.md)**: Propõe telas LWC modernas e acessíveis antes de codar.
- **[task-refine](./modules/sf/advisors/task-refine/SKILL.md)**: Transforma a ideia numa task escrita com o impacto real: o que muda, perguntas em aberto, critérios de aceite e cenários de teste.

## Segurança

- Lê **apenas metadados**, nunca registros. Quando a resposta depende de dados (um custom setting, por exemplo), ele entrega a SOQL para você conferir.
- **Não guarda credenciais**: o acesso às orgs é o do seu `sf` CLI.
- Toda ação fica num **histórico local** (`reldor log`).
- **Não executa Git nem mexe na org.** O Reldor não commita, não faz stash, merge nem checkout, e não roda retrieve, testes nem deploy. Ele confere e mostra os comandos prontos; quem roda é você ou o seu fluxo (por exemplo, a ferramenta do time que cria branch e abre PR). Mudanças só nos arquivos (organizar XML, resolver conflito num arquivo, instalar o gancho ou o merge driver) pedem confirmação antes. Da org, ele só **lê** (os limites, com `reldor limits --org`).
- **Nunca faz deploy.** O [`reldor deploy`](./docs/deploy.md) só monta os comandos. Para produção, só a validação: o deploy segue pela esteira do time.
- **Não manda o seu código para nenhum serviço.** Fora da sua máquina, ele só fala com a sua org pelo `sf` CLI e, se instalado, com o GitHub pelo `gh` (para ler as PRs abertas).
- Nada de cliente mora no Reldor: ambientes, padrões e ferramentas do time ficam no `.reldor/` do repositório do próprio cliente.

## Como é construído

Um **núcleo** genérico e um **módulo** por tecnologia. Salesforce é o primeiro; mobile ou web podem vir depois sem mexer no núcleo. Detalhes na [arquitetura](./docs/architecture.md); os termos que usamos estão no [glossário](./GLOSSARY.md); as decisões, em [docs/adr](./docs/adr).

```
core/        cli, config, status, doctor, profile, tools, runs, spec, git, log, report
modules/sf/  indexer, explain, checks, test-radar, refine, xml, security, quality, merge, promote, rollback, metadata, org, tools, advisors
skills/      as instruções da IA, iguais no Kiro e no Claude Code
adapters/    manifestos finos por IDE
```

## Sugestões e problemas

Abra uma [issue](https://github.com/marlonrodler/reldor/issues): ideia, dúvida ou algo que não funcionou. O código é mantido pelo autor; pull requests de fora não são aceitas.

## Licença

**Livre para usar no trabalho, não é código aberto.** © 2026 Marlon Rodler, sob a [PolyForm Internal Use License 1.0.0](./LICENSE).

- ✅ Pode usar o Reldor, e adaptar, nas operações internas suas e da sua empresa.
- ❌ Não pode distribuir o Reldor nem versões modificadas, vender, oferecer como serviço ou criar um produto concorrente.

Outros usos: fale com o autor.
