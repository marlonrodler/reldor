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

**Por que "provável" e não "certo" para métodos?**
Chamadas por variável (`service.calcularScore()`) não dizem o nome da classe. O Reldor liga pela interface da variável e pela fábrica `Application`: é uma evidência forte, não uma prova.

**Cobre layouts e permissões?**
Sim: page layouts, list views, compact layouts e acesso a campo ou classe em permission sets e profiles. Registros de custom metadata que citam uma classe também contam. Relatórios e Lightning pages ainda não.

## Onde se encaixa

O `usages` já faz a exclusão segura hoje e vai alimentar o plano de rollback e a checagem de queries na Fase 2.
