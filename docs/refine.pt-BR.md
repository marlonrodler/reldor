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

**Escrevo em português e os rótulos do projeto estão em inglês. Funciona?**
Sim. Ele traduz o vocabulário comum de negócio ("entrega de serviço" → Service Delivery, "matrícula no programa" → Program Enrollment, "crédito leve" → Soft Credit), entende plural e ordem invertida das palavras, e lê o nome de API (`ServiceDelivery__c` → service delivery). O nome mais longo ganha: em "entrega de serviço" o objeto é Service Delivery, e Service aparece só como "citado dentro de outro nome". Quando só a última palavra aparece ("o cronograma") e um único objeto termina assim, ele usa e pede para você confirmar. No começo da resposta ele mostra "Entendi assim", com a palavra que levou a cada objeto.

**E se já existir uma regra parecida?**
Ele avisa: se uma validation rule ou um flow ativo dos mesmos objetos fala das mesmas coisas que o pedido, aparece "Já existe algo parecido", para você ver se a task é ajustar essa regra em vez de criar outra.

**Ele não achou o meu objeto.**
Informe com `--objects Opportunity` ou `--fields Opportunity.Etapa__c`.

**O tamanho é uma estimativa?**
Não. Ele conta as peças que a task toca. Use para pegar uma task "pequena" que, na verdade, é grande.

## Onde se encaixa

É o primeiro passo do fluxo: refine → [explain](./explain.pt-BR.md) → desenvolver → [test-radar](./test-radar.pt-BR.md).
