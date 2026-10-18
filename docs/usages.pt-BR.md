<p align="center"><a href="./usages.md">English</a> · <strong>Português</strong></p>

# usages

## O que faz

O `usages` lista todos os lugares onde algo é usado: um campo (`Account.CPF__c` ou só `CPF__c`), uma classe, um método (`AccountsService.calcularScore`), um flow ou um objeto. Ele procura em Apex, selectors, triggers, flows, validation rules, fórmulas, roll-ups, atualizações de campo de workflow e imports de LWC.

Cada resultado vem com um grau de certeza. **Certo**: o nome é usado diretamente. **Provável**: o código usa a classe ou a interface dela no fflib e chama um método com esse nome. **Possível**: o nome só aparece dentro de um texto, como em `Type.forName('...')`, que uma busca comum deixaria passar.

## Quando usar

Pergunte "onde isso é usado?" ou "vou apagar X", ou rode `reldor usages <item>`. Use antes de apagar ou renomear qualquer coisa, antes de mudar o tipo de um campo e durante um rollback.

Para ver o que roda quando um registro é salvo, use o [explain](./explain.pt-BR.md).

## Está funcionando se

- Seus deploys param de falhar com erro de "referenciado por" depois de apagar algo.
- Os itens "provável" e "possível" fazem você olhar duas vezes, e às vezes eles importam.

## Perguntas comuns

**Campo com o mesmo nome em vários objetos (`Status__c`, `Contact__c`) se mistura?**
Não. Cada uso é ligado ao objeto dono do campo pelo que o código diz: o tipo da variável (`List<Account> contas`), o `FROM` da query (subconsultas e semi-joins também), `new Account(...)`, o caminho `Pai__r.Campo__c`, o retorno de um método, a classe de dados com a propriedade, o elemento do flow ou o `$Record`, o formulário ou os imports da tela, a coluna do relatório, a lista relacionada do layout. O que é de outro objeto aparece separado em "Fora da lista", para nada sumir em silêncio.

**E quando o código não diz o objeto?**
Acontece com nome de campo em texto passado para código dinâmico, por exemplo `'Status__c'` numa lista de campos ou `prefix + 'Role__c'`. Aí o item vem como **possível**, com a linha, o motivo e os objetos que têm um campo com esse nome. Se só um objeto do projeto tem aquele campo, ele é certo.

**Cobre layouts, permissões e outros metadados?**
Sim: layouts (inclusive listas relacionadas), list views, compact layouts, record types, permission sets e profiles, reports, report types, dashboards, quick actions, páginas Lightning, field sets, sharing sets, regras, apps, registros de custom metadata, Apex, triggers, flows, LWC, Aura e Visualforce.

**O que fica de fora?**
Testes Jest (`__tests__`), comentários e frases (mensagens de erro e de assert que só citam o campo).

## Onde se encaixa

O `usages` já faz a exclusão segura hoje e vai alimentar o plano de rollback e a checagem de queries na Fase 2.
