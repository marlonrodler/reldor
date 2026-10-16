<p align="center"><a href="./index-command.md">English</a> · <strong>Português</strong></p>

# index

## O que faz

O `index` lê os metadados do projeto e monta um sumário da org: objetos, campos, validation rules, record types, triggers, classes Apex (tipo, SOQL, DML, campos usados, selectors e domains do fflib), flows, workflow rules e LWC. Ele nunca guarda registros e nunca guarda o código em si, só nomes e ligações.

É incremental: na próxima vez, só relê os arquivos que mudaram de tamanho ou data, então continua rápido em projetos grandes.

## Quando usar

Quase nunca é preciso: o `explain` e o `usages` atualizam o índice sozinhos. Rode `reldor index` para ver os totais, ou `reldor index --full` para refazer do zero.

## Está funcionando se

- A segunda execução quase não lê nada.
- Os totais batem com o seu projeto.

## Perguntas comuns

**Onde ele fica?**
Em `.reldor/cache/`, fora do Git. Cada dev tem o seu.

**Um arquivo não pôde ser lido. Isso é um problema?**
O resto do índice continua funcionando. A mensagem diz qual arquivo foi, para você conferir.

## Onde se encaixa

É o motor por trás de todas as respostas do Reldor.
