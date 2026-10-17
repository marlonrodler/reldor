<p align="center"><a href="./env.md">English</a> · <strong>Português</strong></p>

# env

## O que faz

A cadeia de ambientes é **configuração, não código**. Cada projeto diz, no `.reldor/reldor.config.yaml`, quais ambientes tem, em que ordem e qual branch cada um usa. Qualquer nome, qualquer branch, qualquer quantidade de ambientes.

O `reldor env` mostra a cadeia e deixa mudar:

```
1. pre-uat → develop/time-a
2. uat → release/uat
3. producao → master  (produção, deploy bloqueado)

• As branches de desenvolvimento nascem de: master
• Nome sugerido da branch de merge: merge/{feature}-{env}
```

| Para mudar | Comando |
|---|---|
| A cadeia (a ordem é a ordem de promoção) | `reldor env set "pre-uat:develop/x, uat:rc/uat, prod:master"` |
| Qual ambiente é produção (deploy bloqueado) | `reldor env --production prod` (padrão: o último) |
| De onde nascem as branches de desenvolvimento | `reldor env --base master` (padrão: a branch de produção) |
| Padrão do nome da branch de merge | `reldor env --merge-branch "merge/{env}/{feature}"` |
| Padrão do nome da branch de rollback | `reldor env --rollback-branch "rollback/{id}"` |

As orgs (`org:`) dos ambientes com o mesmo nome são mantidas quando você muda a cadeia.

## Quando usar

Uma vez por projeto, e sempre que as branches do time mudarem. Diga "muda os ambientes para ...". Commite o `.reldor/reldor.config.yaml` para o time inteiro usar a mesma cadeia.

## Está funcionando se

- `status`, `promote`, `merge` e `rollback` falam os nomes de ambiente e as branches do seu time.

## Onde se encaixa

O [init](./init.pt-BR.md) pergunta a cadeia na primeira vez; o `env` muda depois.
