<p align="center"><strong>Português</strong> · <a href="./task-refine.en.md">English</a></p>

# task-refine

## O que faz

O `task-refine` escreve uma task Salesforce a partir de uma ideia, usando só os fatos do [refine](../refine.md): um resumo de uma linha, o que muda (seguindo o [automation-design](./automation-design.md): o handler existente, um flow, Queueable...), o impacto, as perguntas em aberto, os critérios de aceite em *dado / quando / então*, os cenários de teste (caminho feliz, o bloqueio e um registro já existente) e o sinal de tamanho. Depois, pergunta se você quer responder as perguntas em aberto agora.

## Quando usar

A IA usa quando alguém quer criar, escrever, refinar ou dimensionar uma task, história ou demanda.

## Está funcionando se

- O dev começa sem uma rodada de perguntas.
- Os critérios de aceite citam os record types e os registros que já existem.

## Onde se encaixa

É o redator em cima do [refine](../refine.md). Combine com o [spec-review](./spec-review.md) quando a spec existir.
