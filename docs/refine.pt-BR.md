<p align="center"><a href="./refine.md">English</a> · <strong>Português</strong></p>

# refine

## O que faz

O `refine` recebe a ideia de uma task em palavras simples ("bloquear o fechamento da oportunidade sem proposta aprovada") e devolve os fatos em volta dela. Ele acha os objetos e campos que a ideia cita, pelo nome de API, pelo rótulo, por um valor de picklist ou por uma palavra comum em português ou inglês (*conta*, *oportunidade*, *caso*...). Para cada objeto, lista as triggers e a cadeia dos handlers, os flows ativos, as validation rules, os record types, as workflow rules legadas, a cascata de roll-up, as telas (LWC), os bypasses e quantos testes tocam nele. Para cada campo: se existe, o tipo e onde é usado.

Só a partir desses fatos, ele acrescenta **pontos de atenção** (o objeto já tem trigger, então a lógica entra no handler), **perguntas em aberto** (quais record types? e os registros que já existem? qual o volume?) e um **sinal de tamanho** (pequeno, médio ou grande, pelo número de peças envolvidas; não é estimativa de horas).

O conselheiro [task-refine](./advisors/task-refine.pt-BR.md) transforma isso na task escrita.

## Quando usar

Diga "quero criar uma task para..." ou "refina essa task", ou rode `reldor refine "<ideia>"`. Use **antes** de a task ir para o quadro, principalmente quando quem escreve não programa.

## Está funcionando se

- As perguntas são respondidas no refinamento, e não no meio do desenvolvimento.
- As tasks param de voltar por causa de uma automação que ninguém citou.

## Perguntas comuns

**Ele não achou o meu objeto.**
Os rótulos dos objetos padrão em outros idiomas não ficam no repositório. Informe com `--objects Opportunity` ou `--fields Opportunity.Etapa__c`.

**O tamanho é uma estimativa?**
Não. Ele conta as peças que a task toca. Use para pegar uma task "pequena" que, na verdade, é grande.

## Onde se encaixa

É o primeiro passo do fluxo: refine → [explain](./explain.pt-BR.md) → desenvolver → [test-radar](./test-radar.pt-BR.md).
