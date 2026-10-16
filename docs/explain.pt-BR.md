<p align="center"><a href="./explain.md">English</a> · <strong>Português</strong></p>

# explain

## O que faz

O `explain` responde "o que acontece quando um registro é salvo?" para um objeto e um evento (insert, update ou delete). Ele lista cada automação na ordem de execução do Salesforce: flows before-save, triggers before, validation rules, triggers after, workflow rules e processos legados, flows after-save, a cascata de roll-up para os registros pai e o que roda de forma assíncrona depois do commit.

A cadeia é montada por scripts a partir do índice, não adivinhada pela IA. As triggers são seguidas até as classes, passando pela fábrica `Application` do fflib, até dois níveis. Um domain do fflib que não implementa o handler daquela fase (por exemplo `onAfterUpdate`) aparece como sem lógica, para você não procurar código que nunca roda.

## Quando usar

Pergunte à IA "o que acontece quando uma Oportunidade é fechada?", ou rode `reldor explain Opportunity --event update`. Use antes de mexer num objeto que você não conhece bem, ao escrever uma task, ao documentar um processo, ao montar um roteiro de teste, ou quando um bug em UAT não faz sentido.

Para "onde este campo ou classe é usado?", use o [usages](./usages.pt-BR.md).

## Está funcionando se

- Nada te surpreende em UAT que o `explain` não tenha listado.
- Os flows condicionais mostram o critério de entrada, então você sabe quando rodam.
- Você enxerga um bypass (custom setting ou custom metadata) antes de testar.
- As classes de teste que ele lista são as que quebram quando você muda o objeto.

## Perguntas comuns

**Ele vê tudo da org?**
Não. Ele lê o repositório. Pacotes gerenciados e o que foi criado direto na org sem retrieve não aparecem. A saída avisa isso sempre.

**Por que a ordem é "simplificada"?**
A ordem completa do Salesforce tem mais etapas (assignment rules, escalation, entitlement, compartilhamento). O `explain` mostra as que vêm do seu código e metadados.

**Ele monta roteiro de teste?**
Sim. Peça à IA: ela transforma cada passo em ação → o que dispara → o que validar.

## Onde se encaixa

O `explain` é o coração da Fase 1. O mesmo índice alimenta o [usages](./usages.pt-BR.md), os conselheiros e, em seguida, o radar de testes e o refinador de task.
