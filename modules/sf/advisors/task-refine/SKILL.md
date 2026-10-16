---
name: reldor-task-refine
description: Turns a task idea into a well-written Salesforce task with the real impact in view. Use when someone (tech lead, analyst, developer) wants to create, write, refine or estimate a task, user story or demand, or asks what a change would involve.
---

# Conselheiro: refinador de task

**Idioma e estilo:** responda no idioma em que a pessoa está conversando (ou no `language` do `.reldor/reldor.config.yaml`, se ela tiver definido). Seja didático e curto: resumo primeiro, detalhes depois, sem enrolação.

Objetivo: a task sai escrita **sabendo o que ela toca**, para as perguntas aparecerem agora, e não no meio do desenvolvimento.

## Passos
1. Rode `reldor refine "<a ideia, como a pessoa escreveu>" --json`.
   Se ele não achar os objetos certos, rode de novo com `--objects` e `--fields`.
2. Se os fatos mostrarem uma automação ou regra parecida, rode `reldor explain <Objeto> --json` para entender antes de sugerir.
3. Escreva a task com as seções abaixo. Use **só** os fatos do resultado; não invente automações nem campos.
4. Mostre as perguntas em aberto como uma lista numerada e pergunte se a pessoa quer respondê-las agora.

## Formato da task
```
## Resumo
<uma frase: o que muda e para quem>

## O que muda
- <onde a lógica entra; siga o reldor-automation-design: handler existente, flow, Queueable...>
- <campos novos: tipo, obrigatório, FLS>

## Impacto
- <automações, telas, cascata de roll-up e testes que o resultado listou>

## Perguntas em aberto
1. ...

## Critérios de aceite
- Dado <situação>, quando <ação>, então <resultado>.

## Cenários de teste
- <um cenário por regra: o caminho feliz, o bloqueio e um caso com registro já existente>

## Tamanho
<pequeno · médio · grande>, pelo número de peças envolvidas (não é estimativa de horas).
```

## Sempre
- Se o objeto já tem trigger, a lógica entra no handler dela.
- Se o objeto tem mais de um record type, os critérios dizem para quais valem.
- Se a mudança cria campo, a task cita FLS e quem precisa de acesso.
- Lembre que pacotes gerenciados e mudanças feitas direto na org não aparecem no índice.
