<p align="center"><strong>Português</strong> · <a href="./init.en.md">English</a></p>

# init

## O que faz

O `init` configura o Reldor num projeto de uma vez. Ele descobre sozinho o que consegue (o projeto Salesforce, o `sf` CLI, a org padrão, o fflib, as specs e as branches) e pergunta só quatro coisas: as branches dos ambientes na ordem de promoção, a org de referência, se o time segue o SLDS e se vocês já usam uma ferramenta que cria branch, commita e abre PR. Ele grava `.reldor/reldor.config.yaml` e `.reldor/profile.md`, e coloca as pastas locais do Reldor no `.gitignore`.

O último ambiente é produção e fica protegido: o Reldor nunca faz deploy, e os testes do `test-radar --run` recusam rodar ali (a não ser com `--allow-production`). Depois de gravar, ele procura sinais de ferramentas do time que já fazem parte do trabalho dele e sugere o [`tools`](./tools.md).

## Quando usar

Diga "quero usar o Reldor" num projeto novo e a IA roda por você, fazendo as perguntas no chat (ambientes, org de referência, design system e se vocês já têm uma ferramenta que cria branch, commita e abre PR: se sim, as ações de Git do Reldor ficam desligadas). No terminal: `reldor init`, ou `reldor init --yes --envs develop,rc/uat,master --org uat --design-system slds --git-actions off`.

## Está funcionando se

- Um dev novo fica pronto em poucos minutos.
- O `reldor status` mostra os ambientes e a spec certos logo depois.

## Perguntas comuns

**Eu commito a `.reldor/`?**
Commite `reldor.config.yaml` e `profile.md`: são do time todo. As pastas de cache, trabalho e log ficam fora do Git.

**Como mudo as respostas?**
Edite o YAML ou rode `reldor init --force`.

## Onde se encaixa

Roda uma vez por projeto. Todo o resto lê o que ele grava.
