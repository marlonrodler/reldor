<p align="center"><a href="./status.md">English</a> · <strong>Português</strong></p>

# status

## O que faz

O `status` diz onde você está e o que fazer agora: a branch atual, os arquivos ainda não commitados, os dados do projeto Salesforce, a spec ligada à branch e **em quais ambientes a sua feature já está** (por exemplo ✅ develop · ⬜ uat · ⬜ produção). No fim, sugere um próximo passo.

Ele compara os commits próprios da sua branch (os que ainda não estão em produção) com cada branch de ambiente, dando preferência à branch remota (`origin/...`).

## Quando usar

É a primeira coisa que a IA roda quando você diz "quero usar o Reldor". No terminal: `reldor status`, `reldor status --fetch` para atualizar as branches remotas antes, ou `--json` para scripts.

## Está funcionando se

- Você para de perguntar "isso já foi pra UAT?".
- O próximo passo sugerido é o que você faria.

## Perguntas comuns

**Ele diz que falta um commit em UAT, mas eu já fiz o merge.**
Rode com `--fetch`: a sua cópia local de `origin/...` pode estar desatualizada.

## Onde se encaixa

O `status` é os olhos do roteador. A skill `reldor` lê o resultado para decidir o próximo passo.
