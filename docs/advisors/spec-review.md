<p align="center"><strong>Português</strong> · <a href="./spec-review.en.md">English</a></p>

# spec-review

## O que faz

O `spec-review` lê uma spec (requisitos, design, tarefas) antes de ela rodar e aponta só as lacunas que existem: volume esperado, o que acontece com registros que já existem, critérios de aceite mensuráveis, quem usa e com quais permissões, comportamento em erro, record types e conflito com automações que já estão no objeto. Para cada lacuna, explica por que importa e sugere o texto que falta. Se não falta nada relevante, fica quieto.

## Quando usar

A IA usa quando uma spec é criada ou alterada, ou logo antes de as tarefas de uma spec rodarem (pelo seu gerador de specs ou pela própria IA). Você também pode pedir "revisa esta spec".

## Está funcionando se

- As perguntas aparecem no refinamento, e não no meio do desenvolvimento.
- Às vezes ele não diz nada, porque a spec já estava boa.

## Onde se encaixa

Funciona com qualquer gerador de specs, ou sem nenhum. Combine com o [automation-design](./automation-design.md) quando a spec trouxer regra de negócio.
