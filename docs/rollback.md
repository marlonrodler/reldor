<p align="center"><strong>Português</strong> · <a href="./rollback.en.md">English</a></p>

# rollback

## O que faz

O `rollback <número da PR | commit | branch>` monta o plano completo para desfazer uma mudança, **sem alterar nada**:

- os commits a desfazer e os ambientes onde eles estão;
- o que **volta** à versão anterior (o `git revert` cuida disso);
- o que a PR **criou** e precisa ser apagado da org, com um `destructiveChanges.xml` pronto e um `package.xml` vazio em `.reldor/work/rollback-<id>/`;
- os **riscos**: um item a apagar que outra coisa passou a usar depois da PR (o deploy falharia), arquivos que mudaram de novo depois da PR (o revert pode dar conflito ou desfazer trabalho de outra pessoa), e o que significa apagar cada tipo (um campo leva os dados junto, um flow precisa ser desativado antes, um record type em uso não pode ser apagado).

Os passos seguem o fluxo do time: uma branch `rollback/...` a partir da produção e um `git revert` **dos commits da feature** (e não do merge), para o rollback passar pela esteira em ordem, como qualquer feature, com o [promote](./promote.md) em cada ambiente.

O número da PR é achado na mensagem do commit de merge ("Merge pull request #123", "Merged PR 123").

## Quando usar

Diga "preciso fazer rollback da PR 123". A IA mostra o plano e os riscos. O Reldor não executa nenhum passo do rollback: o passo a passo fica para você rodar, ou para o seu fluxo. O deploy nunca é feito pelo Reldor.

## Está funcionando se

- Um rollback não quebra o deploy por causa de um campo que alguém passou a usar.
- Ninguém descobre em produção que faltava um destructive change.

## Perguntas comuns

**Ele faz o deploy?**
Não. Ele dá o comando de uma validação sem salvar (`--dry-run`). O deploy continua com a esteira.

**E os dados dos registros?**
Dados carregados ou mudados pela feature não voltam com um rollback de metadados. O plano lembra disso.

## Onde se encaixa

Depois de um problema num ambiente. Em seguida, o [promote](./promote.md) leva a branch de rollback pelos ambientes.
