<p align="center"><strong>Português</strong> · <a href="./retrieve.en.md">English</a></p>

# retrieve

## O que faz

Monta o comando de retrieve da org certa. O Reldor **não roda** o retrieve: ele mostra o comando, você roda.

**Antes de mexer num arquivo** (`reldor retrieve --files <arquivos>`): o arquivo que já existe vem antes da org de
referência (a `reference_org` do `reldor env`; sem ela, a org padrão do projeto), para a mudança partir do que está lá
de verdade, e não de uma cópia velha da branch.

- Ele monta o `sf project retrieve start --metadata ...` só desses arquivos.
- Deixa de fora, explicando por quê: arquivo com mudança sua não commitada (o retrieve apagaria), profile sozinho (vem
  pela metade da org e apagaria o resto do arquivo) e o que não é metadado.
- Anota como cada arquivo estava. Depois que você roda, **`reldor retrieve --check`** confere se o retrieve reescreveu
  mesmo cada um. Só então a IA mexe.
- O `review` avisa (`[retrieve]`) quando um arquivo que já existia foi alterado sem esse retrieve antes.
- **`reldor retrieve --compare --files <arquivos>`** traz a versão da org para `.reldor/work/org-copy`, sem tocar nos
  seus arquivos, para comparar o que já foi alterado.

**O projeto inteiro** (`reldor retrieve`, sem arquivos): monta o retrieve e, depois dele, o `reldor snapshot`, a foto que
deixa o que veio da org fora do seu commit (veja o [`commit`](./commit.md)).

## Quando usar

A IA usa sozinha antes de alterar um arquivo existente: você só roda o comando que ela mostra e diz "rodei". Arquivo
novo não precisa. Se o seu time traz da org de outro jeito, desligue com `reldor tools set retrieve-first skip`.

## Está funcionando se

- A IA não altera uma classe, flow ou LWC existente sem antes te passar o retrieve dele.
- `reldor retrieve --check` diz "Vieram da org" para os arquivos que você trouxe.
- O `review` não mostra `[retrieve]`.

## Perguntas comuns

**Rodei o retrieve, mas o `--check` diz que o arquivo continua igual.**
O retrieve não rodou, falhou, ou foi de outra org. Rode de novo e confira a saída do `sf`.

**Por que o profile fica de fora?**
Um profile trazido sozinho vem só com parte das permissões e sobrescreveria o arquivo inteiro da branch.

## Onde se encaixa

No desenvolvimento, antes de cada arquivo existente que a task altera. O que vem da org conta como seu no commit, porque
foi você quem pediu aqueles arquivos.
