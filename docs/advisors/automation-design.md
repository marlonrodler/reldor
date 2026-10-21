<p align="center"><strong>Português</strong> · <a href="./automation-design.en.md">English</a></p>

# automation-design

## O que faz

O `automation-design` recomenda um lugar para a regra de negócio morar (flow before-save, flow after-save, trigger com handler, Queueable, Batch, Schedulable ou Platform Event) e mostra a segunda melhor opção. Ele decide a partir do que **já existe** no objeto, usando o [explain](../explain.md), e dos critérios do time em `.reldor/profile.md`.

Ele sempre avisa quando o objeto já tem trigger (use o handler dela, nunca uma segunda trigger), quando um flow e uma trigger gravam o mesmo campo, e quando há risco de recursão ou de limites. Ele prefere Queueable a `@future`.

## Quando usar

A IA usa antes de criar ou alterar uma automação. Você pode perguntar "onde essa regra deve ficar?".

## Está funcionando se

- Nenhum objeto termina com duas triggers.
- A recomendação cita as automações que levou em conta.

## Onde se encaixa

Fica entre o [task-refine](./task-refine.md) e o código.
