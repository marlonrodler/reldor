<p align="center"><a href="./collisions.md">English</a> · <strong>Português</strong></p>

# collisions

## O que faz

O `collisions` olha as outras branches abertas (locais e `origin/`) com commits nos últimos 30 dias e lista as que mexem nos mesmos arquivos que a sua, com o risco:

| Risco | Quando |
|---|---|
| 🔴 Alto | As mesmas linhas foram mudadas nas duas branches: o conflito é quase certo |
| 🟡 Médio | Mesmo arquivo, partes diferentes |
| ⚪ Baixo | Profiles, permission sets, labels e parecidos: o [merge inteligente](./promote.pt-BR.md#merge-inteligente) junta item a item |

Para cada branch mostra o autor, a data do último commit e os ambientes aonde ela já chegou. Branches de ambiente, a sua própria branch e as que já estão em produção ficam de fora.

## Quando usar

Ao começar uma task numa classe compartilhada, e antes de promover. Diga "mais alguém está mexendo nesses arquivos?". O `--fetch` atualiza as branches remotas antes; o `--days 60` olha mais para trás.

## Está funcionando se

- Você fica sabendo da outra branch antes do conflito, e não no meio do merge.

## Perguntas comuns

**Ele lê as branches do servidor?**
Só o que o Git já tem localmente. Use `--fetch` para atualizar.

## Onde se encaixa

Junto com o [promote](./promote.pt-BR.md): o collisions avisa cedo, o ensaio mostra o conflito de verdade.
