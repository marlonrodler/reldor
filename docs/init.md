<p align="center"><strong>Português</strong> · <a href="./init.en.md">English</a></p>

# init

## O que faz

O `init` configura o Reldor num projeto de uma vez, **sem perguntar nada**. Ele descobre o que consegue (o projeto Salesforce, o `sf` CLI, a org padrão do `sf`, as specs) e grava só isso:

- `.reldor/reldor.config.yaml`: os módulos, a org padrão do `sf` como org de referência (se houver uma), o design system (`slds`, a não ser que você diga outro);
- `.reldor/profile.md`: o perfil do projeto (veja abaixo);
- as pastas locais do Reldor (cache, log, work) no `.gitignore`.

Branches dos ambientes e org **não são perguntadas no início**: só alguns comandos precisam delas, e esses pedem na hora (por exemplo, o `retrieve` sem org diz "Qual org? Rode de novo com --org <alias>"). Para deixar anotado, use o [`env`](./env.md). Depois de gravar, ele procura sinais de ferramentas do time que já fazem parte do trabalho dele e sugere o [`tools`](./tools.md).

O Reldor nunca roda nada no Git nem na org: ele confere e mostra os comandos prontos para você rodar.

### O profile.md

É o que a IA e o time leem sobre o projeto. Tem duas partes:

- **a parte automática**, entre as marcações `reldor:auto`, lida do índice do projeto (todos os arquivos): pastas de pacote, versão da API, quantas classes (e de teste), triggers, flows, LWCs e objetos, se usa fflib (quantos services, selectors e domains), trigger handlers e a base mais usada, como as classes de teste terminam e quantas classes declaram sharing. Duas seções a mais:
  - **Padrões de projeto**: triggers (uma por objeto? com lógica dentro?), assíncrono (Queueable, Batch, Schedulable, `@future`), testes (factories de dados, `@TestSetup`, mocks), padrões clássicos (Strategy, Factory, Builder, DTO/Wrapper, Singleton, exceções próprias, Unit of Work, log), configuração (Custom Metadata, Custom Settings, Custom Labels), integração e quantos campos customizados, com classes de exemplo;
  - **Times e código compartilhado**: os times confirmados (veja o [`teams`](./teams.md)) com o que é de cada um, ou as palavras que se repetem nos nomes enquanto nenhum time foi confirmado, os helpers e quantos métodos se repetem entre times (veja o [`helpers`](./helpers.md));
- **"Padrões da equipe"**, com tópicos para o time preencher (prefixos por time, classes compartilhadas, quando usar Flow ou Apex, regras de nome). O Reldor nunca muda essa parte.

O `reldor profile` relê o projeto e reescreve só a parte automática. Para preencher a parte do time, peça à IA: "me ajude a preencher o profile do Reldor". Ela mostra o que o Reldor encontrou e pergunta o resto.

## Quando usar

Diga "quero usar o Reldor" num projeto novo e a IA roda por você. No terminal: `reldor init`. Todas as opções são opcionais: `--envs "pre-uat:develop/x, uat:rc/uat, producao:master"`, `--org <alias>`, `--design-system <nome>`.

## Está funcionando se

- Um dev novo fica pronto em um minuto, sem responder nada.
- O `profile.md` mostra os números reais do projeto (classes, triggers, fflib).

## Perguntas comuns

**Eu commito a `.reldor/`?**
Commite `reldor.config.yaml` e `profile.md`: são do time todo. As pastas de cache, trabalho e log ficam fora do Git.

**O profile.md ficou desatualizado.**
Rode `reldor profile`. A parte do time fica como está. Um `profile.md` antigo, de antes das marcações, mantém tudo a partir de "## Padrões da equipe".

**Como mudo a configuração?**
Ambientes e org pelo [`env`](./env.md); o resto editando o YAML ou com `reldor init --force`.

## Onde se encaixa

Roda uma vez por projeto. Todo o resto lê o que ele grava.
