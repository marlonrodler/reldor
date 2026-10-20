---
name: reldor-spec-review
description: Revisa uma spec ou task Salesforce antes da execução e aponta lacunas. Use quando uma spec for criada ou alterada, ou antes de executar as tarefas de uma spec.
---

# Conselheiro: revisão de spec

**Idioma e estilo:** responda no idioma em que a pessoa está conversando (ou no `language` do `.reldor/reldor.config.yaml`, se ela tiver definido). Seja didático e curto: resumo primeiro, detalhes depois, sem enrolação.

Objetivo: encontrar o que falta **antes** de codar, porque spec ruim gera código errado.

## Passos
1. Leia a spec (requisitos, design e tarefas).
2. Rode `reldor refine "<o objetivo da spec, em uma frase>" --json` para saber quais objetos, campos e automações ela toca
   (e `reldor explain <Objeto> --json` para a ordem de execução de um objeto que ela muda).
3. Verifique as lacunas abaixo. Liste **só as que existem**.

## Lacunas comuns
- Volume esperado de registros (muda Flow x Batch).
- O que acontece com **registros já existentes**.
- Critérios de aceite mensuráveis.
- Perfis e permissões de quem usa.
- Comportamento em erro (mensagem, rollback, log).
- Record types e picklists afetados.
- Conflito com automações que já existem no objeto.

## Saída
> 🛡️ Encontrei N lacunas na spec:
> 1. <lacuna> — por que importa — texto sugerido
>
> Quer que eu ajuste a spec?

Se não encontrar nada relevante, **não diga nada**.
