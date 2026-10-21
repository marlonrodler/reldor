<p align="center"><strong>Português</strong> · <a href="./refine.en.md">English</a></p>

# refine

## O que faz

O `refine` recebe a ideia de uma task em palavras simples ("bloquear o fechamento da oportunidade sem proposta aprovada") e devolve os fatos em volta dela. Ele acha os objetos e campos que a ideia cita, pelo nome de API, pelo rótulo, por um valor de picklist ou por uma palavra comum em português ou inglês (*conta*, *oportunidade*, *caso*...). Para cada objeto, lista as triggers e a cadeia dos handlers, os flows ativos, as validation rules, os record types, as workflow rules legadas, a cascata de roll-up, as telas (LWC), os bypasses e quantos testes tocam nele. Para cada campo: se existe, o tipo e onde é usado.

Só a partir desses fatos, ele acrescenta **pontos de atenção** (o objeto já tem trigger, então a lógica entra no handler), **perguntas em aberto** (quais record types? e os registros que já existem? qual o volume?) e um **sinal de tamanho** (pequeno, médio ou grande, pelo número de peças envolvidas; não é estimativa de horas).

### Em etapas, sem ruído

Com a task **no padrão** (um bloco `alvos:` no topo do arquivo, com os objetos, campos, valores e o que a task pede para criar), o `refine` procura **só os alvos**, nunca cada palavra do texto:

1. **Nomes:** cada alvo, do jeito que a task escreve ("Status da aprovação", "Conta"), vira o nome de API, com o grau de certeza: certo, provável, dúvida (dois candidatos quase iguais) ou não achei. Só a dúvida vira pergunta.
2. **Fatos** de cada objeto e campo (os de sempre, acima), e para cada valor de picklist o comando do [`access`](./access.md).
3. **Já existe? (`reuse`)**: para cada item a **criar** (campo, objeto, classe ou método, flow, LWC), o que o projeto já tem com o mesmo sentido, pelo rótulo, pelo nome e pela descrição, em português e inglês. Para cada candidato: de qual time é (pelo prefixo) ou se é compartilhado, quantos usos e quantas automações dependem dele, e a sugestão:
   - **reusar**, como está, quando é compartilhado ou do seu time e nada de outro time depende dele;
   - **criar genérico**, quando é de outro time ou automações de outro time dependem dele: não mexer no deles, criar um compartilhado e oferecer para eles;
   - **criar novo**, quando nada é parecido.
   Renomear o que existe nunca é sugerido: numa org grande, isso quebra relatórios, integrações e o código de outros times.
4. **Limites:** se os campos novos deixam o objeto perto de um limite, ele avisa (veja o [`limits`](./limits.md)).

Sem o bloco `alvos`, ele avisa que a task não está no padrão e usa as palavras do texto, como antes. O resultado fica salvo na pasta da tarefa (`.reldor/work/tasks/<número>/refine.json`, veja o [`task`](./task.md)).

O conselheiro [task-refine](./advisors/task-refine.md) faz o caminho todo: acha a tarefa e a spec, deixa o texto no padrão, roda o refine e o access, e escreve a task (ou completa a spec que já existe) onde você escolheu.

## Quando usar

Diga "quero criar uma task para..." ou "refina essa task", ou rode `reldor refine "<ideia>"`. Use **antes** de a task ir para o quadro, principalmente quando quem escreve não programa.

Com a IA, o caminho é outro, para ter menos ruído: ela **grava o texto** da task em `.reldor/work/task.md` (texto longo na linha de comando quebra o terminal), **interpreta primeiro** quais objetos, campos e valores a task pede, e roda `reldor refine --file .reldor/work/task.md --objects Obj1,Obj2 --fields Obj.Campo --values "Obj.Campo=Valor"`. Com `--objects` ou `--fields`, palavras soltas do texto não viram objeto: aparecem só como "talvez". Cada valor de picklist citado traz o comando do [`access`](./access.md), que mostra se o valor já existe e onde falta liberar.

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

É o primeiro passo do fluxo: refine → [explain](./explain.md) → desenvolver → [test-radar](./test-radar.md).
