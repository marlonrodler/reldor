<p align="center"><strong>Português</strong> · <a href="./status.en.md">English</a></p>

# status

## O que faz

O `status` diz onde você está e o que fazer agora: a branch atual, os arquivos ainda não commitados, os dados do projeto Salesforce, a spec ligada à branch e **em quais ambientes a sua feature já está** (por exemplo ✅ develop · ⬜ uat · ⬜ produção). No fim, sugere um próximo passo.

**Avisos automáticos.** Se a sua branch ainda não está no próximo ambiente, o `status` faz sozinho o [ensaio de promoção](./promote.md) e o [radar de colisão](./collisions.md) e mostra **só os problemas**, por exemplo:

```
🛡️  Avisos (se subir agora):
🔴 campo Perfil_Risco__c não existe em uat (só em develop), e a sua mudança usa (RiscoService.cls).
🟡 ana (feature/x, PR #45 para develop) mudou as mesmas linhas que você em ContaController.cls.
```

Sem problemas, não aparece nada. O resultado fica guardado por 30 minutos para o mesmo commit; `--quick` pula os avisos.

Ele compara os commits próprios da sua branch (os que ainda não estão em produção) com cada branch de ambiente, dando preferência à branch remota (`origin/...`).

## Quando usar

É a primeira coisa que a IA roda quando você diz "quero usar o Reldor". No terminal: `reldor status`, `reldor status --fetch` para atualizar as branches remotas antes, ou `--json` para scripts.

## Está funcionando se

- Você para de perguntar "isso já foi pra UAT?".
- O próximo passo sugerido é o que você faria.

## Perguntas comuns

**Ele diz que falta um commit em UAT, mas eu já fiz o merge.**
Rode com `--fetch`: a sua cópia local de `origin/...` pode estar desatualizada.

**O que é "Ferramentas do time"?**
O que outra ferramenta faz no lugar do Reldor (veja o [`tools`](./tools.md)), e os sinais de ferramentas que ele encontrou e você ainda não decidiu. Enquanto houver sinal sem decisão, o próximo passo é conferir com `reldor tools`.

## Onde se encaixa

O `status` é os olhos do roteador. A skill `reldor` lê o resultado para decidir o próximo passo.
