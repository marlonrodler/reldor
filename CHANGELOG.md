<p align="center"><strong>Português</strong> · <a href="./CHANGELOG.en.md">English</a></p>

# Histórico de versões

## 0.23.0

- **Menos comandos à vista:** a ajuda mostra os 14 do dia a dia e os 6 de configuração; as peças ficam em
  `reldor help --all`.
- **O Reldor nunca executa Git nem org.** Saiu o `execute: on`. `commit`, `merge`, `retrieve` e `test-radar --run`
  só entregam os comandos. O resultado dos testes volta por `reldor test-radar --result <arquivo>`. Da org, só leitura.
- `clean` virou `reldor commit --stash-org` (e `--undo`); `reldor clean` continua como nome curto. Depois do commit,
  `reldor snapshot --after-commit` anda com a foto.
- `reldor task` (novo): a tarefa pelo número da branch (formato aprendido do repositório), a spec em qualquer
  ferramenta (Kiro, Spec Kit, OpenSpec, outra pasta), a fase, uma pasta por tarefa, aviso de troca de tarefa, a pasta
  de documentação do time e para onde vai a task refinada (`output`). O `status` traz a tarefa.
- Refinamento em etapas: com o bloco `alvos` no topo da task, o `refine` busca só os alvos (nomes viram API com grau
  de certeza), diz o que já existe para **reusar** ou **criar genérico** (dono, usos, automações; nunca renomear) e os
  limites. O conselheiro task-refine faz o caminho todo e absorveu o spec-review.
- `reldor limits` (novo): campos, relacionamentos, master-detail, roll-ups e validation rules por objeto, valores de
  picklist e fórmulas, pelo projeto; `--org` lê os limites da org (só leitura).

## 0.22.0

- `reldor access` (novo): "já existe, mas está liberado?". Para um campo e um valor de picklist: o valor (ativo?
  parecidos?), picklist dependente, record types e business processes, FLS em profiles e permission sets, layout de
  cada record type, páginas, path, traduções e regras ou código que citam os outros valores. Também objeto e classe.
- `reldor refine --file <arquivo>`: texto longo por arquivo, sem quebrar o terminal. `--values "Obj.Campo=Valor"`.
  Com `--objects`/`--fields` (a IA interpreta primeiro), palavras soltas não viram objeto: ficam em "talvez".
  Cada valor citado aponta o `access`.
- Conselheiro task-refine: grava a task em arquivo, interpreta antes, roda o refine e o access, e põe na task o que
  falta liberar.

## 0.21.0

- `profile.md` ganha **Padrões de projeto** (triggers, assíncrono, testes e mocks, Strategy, Factory, Builder, DTO,
  Singleton, exceções, Unit of Work, log, configuração, integração, campos) e **Times e código compartilhado** (prefixos
  de time em classes, objetos e campos; o que é compartilhado; helpers), com classes de exemplo. Tudo do índice.
- `reldor helpers <termo>` (novo): os métodos que já existem, compartilhado primeiro. `--similar`: o mesmo método em
  times diferentes, candidato a um método genérico.
- `reldor me --team --prefix` (novo): o seu time, só na sua máquina (`.reldor/local.yaml`, no `.gitignore`); aparece
  em `me` no `status`.
- Skill: antes de criar um método, procura o que existe; se outra área pode usar, propõe um método genérico com
  parâmetros numa classe compartilhada.

## 0.20.1

- `reldor init --json` devolve JSON (antes saía texto, e a IA não conseguia ler o arquivo do `--out`).
- Skill e power: quando o terminal da IDE mistura ou repete o comando e nem o `--out` aparece, a IA para de tentar e pede
  para a pessoa rodar e colar o resultado (e confere a versão instalada).

## 0.20.0

- **Execução desligada** (`execute: off`, o padrão): o Reldor não roda nada no Git nem na org. `commit`, `clean`, `merge`,
  `retrieve`, `test-radar --run` e `rollback` conferem e entregam os comandos prontos, para a pessoa rodar. O commit e o
  clean levam só as suas linhas num patch já conferido. `execute: on` (ou o antigo `git.actions: on`) faz o Reldor rodar,
  sempre com confirmação.
- Confirmação para mudanças em arquivos: `xml`, `merge --resolve` (novo), `hook install` e `merge install` mostram o que
  vão mudar e pedem um "sim". Sem terminal (uma IA) e sem `--yes`, a resposta é não.
- `reldor deploy` (novo): monta a validação (`--dry-run` com os testes do radar), o quick deploy e o deploy direto dos
  arquivos alterados. Nunca executa. Em produção, só a validação; arquivos apagados são listados.
- `reldor init` não pergunta nada: grava só o que detectou. Ambientes e org são pedidos quando um comando precisa
  (`reldor env --org <alias>`, `--org-for "<ambiente>:<alias>"`).
- `profile.md` lido do índice do projeto (todos os arquivos): classes, testes, triggers, flows, LWCs, objetos, fflib com
  services, selectors e domains, trigger handlers, sufixo dos testes, prefixos e sharing. `reldor profile` (novo) atualiza
  essa parte sem mexer em "Padrões da equipe", que agora traz tópicos para o time preencher, com ajuda da IA.

## 0.19.2

- `status` (e tudo que detecta o projeto) não roda mais o `sf` para saber se ele existe e qual a org padrão: procura o `sf` no
  PATH e lê a versão e a org dos arquivos dele. De ~10 segundos para menos de 1 (mais no Windows).
- `--out <arquivo>` em qualquer comando: o resultado vai para o arquivo e o terminal mostra uma linha. Para terminais de IA
  que perdem a saída; a skill e o power usam isso sozinhos quando a saída não volta.

## 0.19.1

- Kiro: o plugin traz também o formato antigo de power (`POWER.md` e `steering/`), gerado das mesmas skills. Versões do Kiro que
  pediam `POWER.md` passam a ativar o Reldor. Para atualizar, remova o power e importe de novo.
- Instalação no Windows: o README explica como pôr a pasta do npm no PATH pelo cmd e o que fazer com o PowerShell restrito
  (`reldor.cmd`). A skill e o power sabem o mesmo.

## 0.19.0

- `reldor tools`: o Reldor convive com as ferramentas do time. Cada coisa que ele faz é uma capacidade (`xml-duplicates`,
  `xml-order`, `org-files`, `security`, `quality`, `code-analyzer`, `queries`, `affected-tests`, `run-tests`,
  `pre-commit`, `profile-merge`), e o projeto escolhe em `tools:` se o Reldor faz (`run`), só confere sem refazer
  (`verify`) ou fica de fora (`skip`). Ele procura sinais dessas ferramentas (ganchos de Git, esteira, instruções da IA,
  scripts do `package.json`, merge driver no `.gitattributes`) e sugere, mostrando a linha; nada é gravado sozinho.
- `review`, gancho pre-commit, `xml`, `security`, `quality`, `check`, `test-radar`, `clean`, `hook install` e
  `merge install` seguem os modos. O que fica com outra ferramenta aparece no resultado com o nome dela. Comandos que
  mudam algo só agem numa capacidade de outra ferramenta com `--force`.
- Execução única: a mesma checagem sobre o mesmo conteúdo roda uma vez (regras de segurança e de qualidade, Code
  Analyzer, testes afetados, queries, XML). O gancho, o `review` e a IA compartilham o resultado (♻️). `--fresh` refaz.
- `status`, `doctor` e `init` avisam quando há sinais de ferramentas do time ainda não decididos.
- Coerência: saíram da configuração as chaves que não faziam nada (`spec.generator`, `advisors.mode` e `enabled`,
  `xml.types`, `index.depth`, `git.clean_commit`, `pre_commit_hook`, `smart_merge`, `test_radar.auto_run`,
  `automations`, `connectors`) e as pastas vazias que prometiam funcionalidades. As skills não mandam mais rodar
  comandos que não existem (`reldor context`, `reldor ask`). README e arquitetura descrevem só o que o Reldor faz hoje,
  com um desenho de como funciona e a seção do Git reescrita.

## 0.18.0

- Documentação em português primeiro: todo documento é `<nome>.md` em português e `<nome>.en.md` em inglês (README,
  CHANGELOG, glossário, AGENTS, docs, ADRs, conselheiros). Um teste confere que todo documento tem os dois.
- README reescrito: o que é o Reldor em um minuto, dois jeitos de instalar (npm ou `git clone`), Kiro e Claude Code passo
  a passo, o primeiro comando e os problemas comuns.
- Guia do Kiro: pelo link do GitHub ou pela pasta clonada.

## 0.17.1

- Segurança: `fast-xml-parser` 4 → 5.11 e `yaml` 2.5 → 2.9, fechando os alertas do `npm audit` (1 crítico, 1 moderado).
  O resultado da leitura é igual ao anterior em 9.716 arquivos de metadado de 16 projetos públicos.

## 0.17.0

- Instalação em uma linha, sem escolher pasta: `npm install -g github:marlonrodler/reldor` (a mesma linha atualiza).
- O Kiro instala por link: o plugin pronto fica em `plugins/kiro/reldor` (Powers → Import power from GitHub). O
  `npm run build:adapters` mantém atualizado e um teste confere.
- `reldor doctor`: confere Node.js, Git, sf CLI, os opcionais, como o Reldor foi instalado, o plugin na IA e a pasta do
  terminal (projeto, Git, configurado, ou a pasta do próprio Reldor por engano) e diz um próximo passo.
- README: instalação passo a passo (onde fica cada coisa, qual terminal, qual pasta, o primeiro comando, problemas
  comuns como a política de scripts do PowerShell).

## 0.16.1

- O conselheiro de refinar task mostra como o pedido foi entendido (`detected.why`), pede confirmação só quando um nome
  foi achado pela última palavra ou dentro de outro nome, e coloca primeiro uma regra parecida que já existe.

## 0.16.0

- O `refine` lê um pedido em português contra rótulos em inglês: glossário de negócio, plural, ordem invertida das
  palavras e nomes de API separados em palavras. O nome mais longo ganha ("entrega de serviço" é Service Delivery;
  Service aparece como citado dentro dele), um nome dito só pela última palavra vale quando um único objeto termina
  assim, objetos padrão contam mesmo sem metadado no projeto, e a resposta começa com "Entendi assim" (qual palavra levou
  a qual objeto). Em 62 pedidos de 9 projetos: 119 de 119 objetos achados, nenhum a mais.
- O `refine` aponta regras que já existem e se parecem com o pedido ("Já existe algo parecido").

## 0.15.0

- O `usages` de um campo ganha "Campos dinâmicos", o segundo olhar do desenvolvedor sobre o que o código só alcança pelo
  nome: objetos que guardam nomes de campo (custom metadata, custom settings, objetos de configuração, relações com
  FieldDefinition) e as classes que usam esses nomes (`record.get(nome)`, mapas de describe, `Database.query(texto)`);
  em custom metadata, os registros do projeto que citam o campo; em custom settings e objetos, uma SOQL pronta para
  conferir na org (o Reldor não lê dados); e todo texto no código que cita o campo sem dizer o objeto.
- O namespace do próprio projeto é entendido (`npsp__Amount__c` é `Amount__c` num projeto `npsp`).
- Tabelas de report type seguem relações filhas mesmo quando um lookup tem o mesmo nome de relação.

## 0.14.0

- O `usages` sabe de qual objeto é cada campo. Um campo com o mesmo nome em vários objetos (`Status__c`, `Contact__c`)
  não se mistura mais: cada uso é ligado ao seu objeto pelo tipo da variável, pelo `FROM` da query (inclusive
  subqueries e semi-joins), por `new Account(...)`, por caminhos `Parent__r.Field__c`, pelo elemento do flow ou
  `$Record`, pelo formulário ou imports da tela, pela coluna do report, pela related list do layout e assim por diante.
  Usos do mesmo nome em outros objetos aparecem à parte ("Fora da lista"), e o que o código não diz (um nome de campo
  num texto passado para código dinâmico) aparece como "possível", com o motivo e os objetos candidatos. Nada fica de
  fora em silêncio.
- O `usages` lê Apex, triggers, flows, LWC, Aura, Visualforce, layouts, record types, permissões, reports, report types,
  dashboards, quick actions, record pages, field sets, sharing sets, registros de custom metadata e regras a partir do
  índice; a varredura de arquivos, mais lenta, saiu.
- `test-radar`: testes que só montam registros em memória não contam mais como "salva"; um `delete` não conta para
  validation rules. Um teste que salva outro objeto cuja trigger, flow ou roll-up salva o objeto alterado é encontrado
  ("salva Contact, e a trigger X de Contact grava Account"). Um campo alterado também traz os testes que usam o campo
  no código; um record type alterado, os testes que usam o nome dele; uma classe alterada, os testes que citam o nome
  dela num texto.
- O DML é lido por método com o tipo declarado da variável (`List<Account>`, `Map<Id, Account>`, casts, minúsculas
  `list<account>`), então "quem salva este objeto" fica exato.
- O índice se refaz sozinho sempre que o código do indexador muda.

## 0.13.0

Correções de uma rodada completa em 16 projetos Salesforce públicos grandes (NPSP, EDA, PMM, Outbound Funds, Volunteers
for Salesforce, os apps de exemplo da Salesforce e outros).

- Índice: métodos Apex com nome de funções do JavaScript (`toString`, `valueOf`) não quebram mais a classe.
- Índice: um `//` ou `/*` dentro de um texto Apex (`'image/*'`, `'https://...'`) não é mais lido como comentário (isso
  escondia o resto da classe). Classes e objetos com nome começando em minúscula (`mc_Recipients`, `npe01__X__c`) são
  encontrados, e os nomes são comparados sem diferenciar maiúsculas, como no Apex.
- `usages`: uma fórmula ou validation rule que lê `Parent__r.Field__c` conta para o campo do objeto pai, não para um
  campo com o mesmo nome no próprio objeto.
- `usages`: uma segunda passada para campos customizados acha reports, report types, dashboards, field sets, páginas
  Lightning, quick actions e prompt templates (certo), LWC/Aura/Visualforce pelo nome (provável) e nomes de campo dentro
  de textos Apex (possível).
- `test-radar`: as factories de dados de teste são seguidas método a método, inclusive em cadeia. Um teste que chama um
  método da factory tem prioridade alta; uma factory que cria muitos objetos não puxa mais todos os testes. Classes
  `@isTest` sem métodos de teste não aparecem como testes.
- `clean --undo` mantém a foto, então o mesmo retrieve pode ser limpo de novo.
- O gancho pre-commit chama este Reldor pelo caminho completo (um `reldor` antigo no PATH podia barrar commits).
- `quality --all`: um achado por texto repetido, query, par de métodos e par de arquivos com blocos copiados, em vez de
  um por ocorrência. O código entre dois textos curtos não é mais confundido com texto repetido.
- `rollback`: o `-meta.xml` ao lado de uma classe ou trigger vai junto, em vez de aparecer como desconhecido.
- `security`: menos alarmes falsos. Classes de teste, "segredos" que são marcadores (`{0}`, `%s`), `escape="false"` do
  Visualforce em labels ou literais, `lwc:dom="manual"` em canvas/svg e classes de dados só com propriedades
  `@AuraEnabled` não são mais apontados.

## 0.12.0

- A cadeia de ambientes é toda configurável: quaisquer nomes, branches e quantidade de ambientes; qualquer um pode ser
  produção (`production: true`, por padrão o último); `git.base_branch` diz de onde nascem as branches de
  desenvolvimento; `git.merge_branch` e `git.rollback_branch` são modelos de nome (`{feature}`, `{env}`, `{id}`).
- `reldor env`: mostra a cadeia e muda (`set "nome:branch, ..."`, `--production`, `--base`, `--merge-branch`,
  `--rollback-branch`), mantendo as orgs já definidas.

## 0.11.0

- `reldor review`: uma revisão antes do commit, com um resumo só: segurança, qualidade e código repetido, campos lidos
  fora da query, testes que a mudança pode quebrar, XML fora de ordem e arquivos que vieram da org. 🔴 corrija antes do
  commit, 🟡 atenção. O Code Analyzer roda uma vez para segurança e qualidade.
- `reldor help` e o README mostram os momentos (e agora, entender, revisar, limpar, merge, subir, desfazer); os comandos
  detalhados aparecem como as peças por trás deles.

## 0.10.0

- `reldor merge <branch>`: merge assistido na branch de merge. `git merge --no-ff --no-commit` e depois cada conflito é
  resolvido com a regra "mantém o destino, aplica só a nossa mudança": mudanças vizinhas entram as duas, inserções no
  mesmo ponto ficam as duas, remoções deixam o destino, XML de metadado é juntado item a item. Só as mesmas linhas
  mudadas dos dois lados ficam para revisão (ou para a IA).
- "Entrou só o seu?": `reldor merge --check` compara, linha a linha, o que mudou na branch de merge com o que a sua
  branch mudou, e aponta linhas que não são suas, linhas do destino que sumiram, linhas que faltam, marcações que
  sobraram e commits de outras pessoas. `--continue` faz o commit do merge depois da conferência; `--abort` desfaz.
- XML e HTML de LWC juntados linha a linha precisam continuar bem formados; senão, outro alinhamento é tentado e, se
  ainda quebrar, o arquivo fica para revisão. Blocos de profile que o Git comum gruda saem inteiros.
- Quando entra algo que não é seu (linhas ou commits de outras pessoas), a conferência diz isso primeiro.
- `reldor clean`: antes de qualquer ferramenta commitar, deixa na pasta só o seu trabalho; o que veio da org vai para um
  stash (`--undo` traz de volta).
- Saíram dos avisos: conflitos (o merge assistido resolve) e o radar de colisão (agora escondido).

## 0.9.0

- `reldor status` avisa sozinho: quando a branch ainda não está no próximo ambiente, roda um ensaio rápido de promoção e
  o radar de colisão e mostra só os problemas reais (dependências faltando, ordem dos commits, conflitos difíceis,
  colegas mudando as mesmas linhas). Guardado por commit por 30 minutos; `--quick` pula.
- `reldor collisions` fica quieto por padrão: só conta o trabalho que está andando (uma pull request aberta, lida com o
  `gh`, ou uma branch já num ambiente). Branches de merge são lidas pela PR delas. `--all` mostra tudo.
- O ensaio rápido também funciona em Git anterior ao 2.38 (dependências sem o merge em memória).

## 0.8.0

- As ações de Git ficam **desligadas por padrão** (`git.actions: off`): o Reldor confere e avisa; branches, commits,
  merges e PRs ficam com a ferramenta do time (ex.: o plugin de fluxo do time). O `reldor init` pergunta. O
  `reldor commit --stage` deixa só as suas linhas no stage, sem commitar. `promote` e `rollback` mostram os passos como
  referência.
- `reldor collisions`: outras branches abertas (últimos 30 dias) que mudam os mesmos arquivos que a sua, com o risco:
  mesmas linhas (alto), mesmo arquivo (médio), metadado que o merge inteligente junta (baixo). Mostra autor, data e
  ambientes.
- `reldor rollback <PR | commit | branch>`: plano de rollback sem mudar nada. O que volta com o revert, o que a PR criou
  e precisa ser apagado (`destructiveChanges.xml` pronto), itens a apagar que ainda são usados, arquivos mudados de novo
  depois da PR, observações por tipo e os passos no fluxo do time (reverter os commits da feature numa branch de
  rollback e promover como uma feature).
- Windows: o Git roda sem o cmd.exe, então revisões como `abc^2` e caminhos com espaço passam como são.

## 0.7.0

- `reldor promote <ambiente>`: ensaio de promoção, sem mudar nada. Lista os commits que vão junto, commits que não
  passaram pelo ambiente anterior (a esteira barraria), commits de outras pessoas (develop juntada ou puxada na branch),
  conflitos (XML de metadado tentado item a item) e campos, objetos e classes que não vão existir no ambiente depois do
  merge, com onde eles existem.
- `reldor merge install | uninstall | status`: merge inteligente para profiles, permission sets, labels, traduções,
  sharing rules, value sets e package.xml, dentro do `git merge` normal. Só o item que os dois lados mudaram de jeitos
  diferentes vira conflito. Também liga o `rerere`. Só na máquina da pessoa (`.git/info/attributes`).
- Simula o merge com `git merge-tree` (Git 2.38+) ou com um worktree temporário em Git mais antigo.

## 0.6.0

- `reldor quality`: aponta a repetição que uma mudança cria, e só ela: blocos copiados de outro lugar do projeto (no
  estilo do CPD, ignorando literais), SOQL que já existe em outra classe, queries fora do Selector do fflib, métodos que
  já existem (mesma assinatura e corpo parecido) ou são 80% parecidos, e textos repetidos em três ou mais classes
  (candidatos a Custom Label). `--all` revisa o projeto inteiro.
- Roda também as regras `Recommended` (PMD) e `cpd` do Code Analyzer, quando instalado. `--fail-on` para scripts.
- Classes que dividem um contrato (dois Selectors, a mesma interface ou classe base) não aparecem como cópia.
- Calibrado em projetos Salesforce públicos (fflib samples, apex-recipes, ebikes, dreamhouse, coral-cloud).

## 0.5.0

- `reldor security`: revisão de segurança dos arquivos alterados (ou `--all`): SOQL injection (valores de fora do
  método concatenados em queries dinâmicas), CRUD/FLS em métodos expostos, sharing nos pontos de entrada, dados
  sensíveis em `System.debug`, segredos e endpoints fixos ou em http, hashes fracos, IDs de registro fixos, XSS em LWC e
  Visualforce, flows em modo de sistema sem sharing, perfis de convidado com acesso demais.
- Achados de caminho: um método exposto que alcança, pela cadeia de chamadas, uma classe `without sharing` que lê ou
  grava dados.
- Roda também as regras de segurança do Salesforce Code Analyzer, quando instalado. `// reldor-ignore: <regra>` cala um
  achado.
- Calibrado em projetos Salesforce públicos para cortar falsos positivos.

## 0.4.0

- `reldor retrieve`: confirma a org, avisa sobre trabalho não commitado e tira uma foto depois de um retrieve amplo (um
  retrieve de metadados específicos conta como seu).
- `reldor commit`: commit limpo. Pega só o que mudou depois da foto, linha a linha, inclusive em arquivos que o retrieve
  mudou; arquivos que só a org mudou ficam de fora; `--include` pega um arquivo inteiro da org; `--dry-run` mostra o
  plano.
- `reldor snapshot`: a foto para retrieves feitos fora do Reldor.
- `reldor xml`: ordena e remove duplicados em profiles, permission sets, labels, traduções, sharing rules, value sets,
  traduções de objeto e package.xml, mexendo só no necessário; aponta duplicados conflitantes.
- `reldor hook install`: gancho pre-commit para todo commit, inclusive feito na mão: barra XML duplicado e arquivos que
  só vieram da org. Mantém um gancho que já exista.
- Validado em projetos Salesforce públicos.

## 0.3.0

- `reldor refine`: os fatos por trás da ideia de uma task. Acha os objetos e campos no texto livre (nomes de API,
  rótulos, valores de picklist, palavras comuns em português e inglês) e devolve automações, telas, cascata de roll-up,
  bypass, testes, pontos de atenção, perguntas em aberto e um sinal de tamanho.
- Novo conselheiro `task-refine`: escreve a task (o que muda, impacto, perguntas em aberto, critérios de aceite,
  cenários de teste, tamanho) a partir desses fatos.

## 0.2.0

- `reldor test-radar`: testes que podem quebrar com as suas mudanças, com motivo e prioridade (objetos, classes,
  permissões, custom metadata, factories). `--run` valida os arquivos alterados numa sandbox sem salvar (`--dry-run` com
  `RunSpecifiedTests`), confirma a org e recusa produção; mostra falhas e a cobertura das classes alteradas.
- `reldor check`: campos lidos fora da SOQL ou do selector.
- Corrigido: o primeiro arquivo do `git status` perdia a primeira letra.
- DML como `insert new Account(...)` agora é reconhecido.

## 0.1.1

Validado em projetos Salesforce públicos (fflib sample code, apex-recipes, dreamhouse, ebikes, coral cloud).

- O `explain` segue só os métodos de cada fase (fflib e no estilo TriggerHandler), inclusive helpers privados.
- O `explain` segue triggers guiadas por metadado: classes handler listadas em registros de custom metadata.
- Profundidade 3 na cadeia; as classes base do framework ficam de fora; uma trigger com o nome de uma classe não esconde
  mais a classe.
- Testes relacionados separados em "usam esta cadeia" e "criam ou mudam o objeto".
- O `usages` acha campos e classes em layouts, list views, compact layouts, permission sets, profiles, registros de
  custom metadata e atribuições de registro em flows.

## 0.1.0

- `reldor index`: índice incremental de objetos, campos, validation rules, record types, triggers, Apex, flows,
  workflow rules e LWC.
- `reldor explain`: automações na ordem de execução, seguindo a cadeia do fflib, com cascata, trabalho assíncrono,
  bypass e testes relacionados.
- `reldor usages`: onde um campo, classe, método, flow ou objeto é usado, com o grau de certeza.
- Conselheiros: `spec-review`, `automation-design`, `lwc-ux`.
- As skills respondem no idioma da conversa, curtas e didáticas.
- README e documentação em inglês e português. Plugin do Claude Code instalável a partir do repositório.

## 0.0.1

- `reldor init`, `reldor status`, `reldor log`. Plugins do Kiro e do Claude Code gerados das mesmas skills.
