<p align="center"><a href="./test-radar.md">English</a> · <strong>Português</strong></p>

# test-radar

## O que faz

O `test-radar` olha o que a sua feature mudou (commits desde produção e o que ainda não foi commitado) e lista os testes Apex que podem quebrar, cada um com o motivo e uma prioridade. Uma validation rule, um campo obrigatório, um record type, uma permissão, um flow ou uma trigger num objeto apontam para todo teste que cria ou altera aquele objeto, inclusive por factories de dados de teste. Uma classe alterada aponta para os testes que a usam, e para os testes um passo mais longe.

Ele também confere as queries das classes alteradas: um campo customizado lido de um registro que a classe consultou, mas que não está na SOQL nem no selector. É o erro "SObject row was retrieved via SOQL without querying the requested field", pego antes de chegar em UAT.

Com `--run`, ele roda esses testes **sem salvar nada**: um deploy de validação (`--dry-run`) dos seus arquivos alterados com `RunSpecifiedTests`, então os testes enxergam as suas mudanças locais. Ele confirma a org antes e recusa produção.

## Quando usar

A IA usa depois que você muda metadado ou Apex, e antes de qualquer deploy. Diga "quais testes podem quebrar?" ou rode `reldor test-radar`. Depois, `reldor test-radar --run --org <sandbox>`.

Ele não muda a sua esteira: a esteira continua rodando os testes dela. O radar só avisa antes.

## Está funcionando se

- A esteira para de falhar em testes que você poderia ter rodado antes.
- Quando ele diz que um teste pode quebrar, geralmente quebra.

## Perguntas comuns

**E se os meus arquivos locais forem diferentes da org?**
Por isso o `--run` manda os arquivos alterados num deploy de validação. Use `--org-code` para rodar contra o que já está na org.

**Ele pode deixar um teste de fora?**
Pode, quando um teste monta o nome do objeto em texto, ou quando o impacto passa por código que o índice não consegue seguir. Trate a lista como o mínimo a rodar, não o máximo.

**Como ele trata as factories de dados de teste?**
Método a método. Um método da factory que insere o objeto conta, e também um método que chama esse (cadeias são seguidas). Um teste que chama um desses métodos ganha prioridade alta ("cria X pela factory"). Uma factory que cria trinta objetos só puxa os testes que chamam os métodos do objeto alterado. Uma classe `@isTest` sem métodos de teste (a própria factory) nunca aparece como teste. Um teste que só monta registros em memória, sem salvar, ganha prioridade média.

**O Salesforce tem RunRelevantTests. Por que não usar?**
É uma boa opção para a esteira. O radar explica *por que* cada teste está na lista e roda antes do push.

## Onde se encaixa

Fica entre o desenvolvimento e a promoção. Usa o mesmo índice do [explain](./explain.pt-BR.md) e do [usages](./usages.pt-BR.md).
