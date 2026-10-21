<p align="center"><strong>Português</strong> · <a href="./limits.en.md">English</a></p>

# limits

## O que faz

O `reldor limits` mostra o que está **perto de um limite** do Salesforce, contando pelo projeto (sem org):

| O quê | Limite |
|---|---|
| Campos customizados por objeto | 500 (Enterprise e Developer), 800 (Unlimited e Performance), 100 (Professional) |
| Campos de relacionamento (lookup e master-detail) por objeto | 40 |
| Master-detail por objeto | 2 |
| Roll-ups por objeto | 25 |
| Validation rules ativas por objeto | 100 (Enterprise e Developer), 500 (Unlimited e Performance), 20 (Professional) |
| Valores numa picklist | 1.000 (multisseleção: 500; padrão como Stage e Status: 100) |
| Tamanho de uma fórmula | 3.900 caracteres |

Sem argumentos, lista só o que está a **80% ou mais**. Com um objeto (`reldor limits Opportunity`), mostra tudo dele. A edição vem de `org.edition` na configuração (Enterprise, se não tiver).

No **refinamento**, quando a task pede para criar campos, ele soma: "Opportunity: com a task, campos customizados vão de 470 para 473 de 500 (95%)". É aí que reusar o que já existe ([refine](./refine.md)) ajuda mais.

Com `--org <alias>`, ele também lê os **limites da própria org** (chamadas de API, armazenamento...) pelo `sf org list limits`. É só leitura, então roda direto, sem pedir.

## Quando usar

Antes de criar campos ou regras num objeto grande, ou para ver como a org está. A IA usa no refinamento. No terminal: `reldor limits`, `reldor limits Account,Opportunity`, `reldor limits --all`, `reldor limits --org minha-sandbox`.

## Está funcionando se

- Ninguém descobre no deploy que o objeto não aceita mais campos.
- A conversa "reusar ou criar?" acontece no refinamento, com o número na mesa.

## Perguntas comuns

**O número está menor do que na org.**
Ele conta o que está no projeto. O que não veio no retrieve não entra; trate como "pelo menos". Campos de pacotes gerenciados têm cota própria e não são contados.

**O roll-up da minha org é maior que 25.**
O Salesforce pode aumentar alguns limites por pedido ao suporte. Use o número como alerta, não como regra.

## Onde se encaixa

No [refinamento](./refine.md), junto com o "já existe?", e antes de criar metadados novos.
