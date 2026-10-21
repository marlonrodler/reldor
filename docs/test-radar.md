<p align="center"><strong>Português</strong> · <a href="./test-radar.en.md">English</a></p>

# test-radar

## O que faz

O `test-radar` olha o que a sua feature mudou (commits desde produção e o que ainda não foi commitado) e lista os testes Apex que podem quebrar, cada um com o motivo e uma prioridade. Uma validation rule, um campo obrigatório, um record type, uma permissão, um flow ou uma trigger num objeto apontam para todo teste que cria ou altera aquele objeto, inclusive por factories de dados de teste. Uma classe alterada aponta para os testes que a usam, e para os testes um passo mais longe.

Ele também confere as queries das classes alteradas: um campo customizado lido de um registro que a classe consultou, mas que não está na SOQL nem no selector. É o erro "SObject row was retrieved via SOQL without querying the requested field", pego antes de chegar em UAT.

Com `--run`, ele roda esses testes **sem salvar nada**: um deploy de validação (`--dry-run`) dos seus arquivos alterados com `RunSpecifiedTests`, então os testes enxergam as suas mudanças locais. Ele recusa produção e **não roda nada na org**: mostra o comando `sf project deploy start --dry-run --json ... > .reldor/work/test-radar/resultado.json` pronto para você rodar, e depois o `reldor test-radar --result .reldor/work/test-radar/resultado.json`, que lê o resultado e mostra as falhas e a cobertura.

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
Método a método, em qualquer profundidade. Um teste que chama um método que salva o objeto (direto ou por outro método) tem prioridade alta. Um teste que só monta o registro em memória, sem salvar, tem prioridade média. A própria factory (`@isTest` sem métodos de teste) nunca aparece como teste. `delete` não conta para validation rule.

**E quando outro objeto salva o objeto alterado?**
Se o teste salva Contact e a trigger, o flow ou o roll-up de Contact grava Account, uma mudança em Account traz esse teste com prioridade média e o motivo ("salva Contact, e a trigger X de Contact grava Account"). Custom settings e custom metadata não entram nessa cascata.

**E para campo, record type e classe?**
Campo: os testes que usam o campo no código vêm com prioridade alta, e os que usam uma classe que usa o campo, média. Salvar o objeto só é alta quando o campo é obrigatório, único ou novo. Record type: os testes que usam o nome dele. Classe: também os testes que citam o nome dela em texto (`Type.forName`, tabelas de handlers).

**O Salesforce tem RunRelevantTests. Por que não usar?**
É uma boa opção para a esteira. O radar explica *por que* cada teste está na lista e roda antes do push.

**A esteira já roda os testes.**
Grave `run-tests: skip` no [`tools`](./tools.md): o radar continua listando os testes, e o `--run` não roda nada (a não ser com `--force`). Com o mesmo conteúdo, a lista de testes não é calculada duas vezes.

## Onde se encaixa

Fica entre o desenvolvimento e a promoção. Usa o mesmo índice do [explain](./explain.md) e do [usages](./usages.md).
