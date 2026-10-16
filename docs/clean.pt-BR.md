<p align="center"><a href="./clean.md">English</a> · <strong>Português</strong></p>

# clean

## O que faz

Depois de um retrieve, a pasta mistura o seu trabalho com o que veio da org. O `reldor clean` deixa na pasta **só o que é seu**, antes de qualquer ferramenta commitar:

- arquivos que só a org mudou saem da pasta;
- em arquivos que os dois mudaram, ficam só as suas linhas;
- os seus arquivos ficam como estão.

O que veio da org vai para um stash do Git chamado "reldor clean", então nada se perde. O `reldor clean --undo` traz de volta (pulando arquivos que você mudou depois da limpeza). O `--dry-run` mostra o plano; o `--include <arquivo>` mantém inteiro um arquivo da org.

Precisa da foto tirada pelo [`reldor retrieve`](./commit.pt-BR.md) (ou do `reldor snapshot` logo depois de um retrieve feito fora do Reldor).

## Quando usar

Na hora de commitar: diga "vou commitar, limpa o que não é meu". Depois commite pela ferramenta de fluxo do time, por outra ferramenta ou pelo [`reldor commit`](./commit.pt-BR.md).

## Está funcionando se

- Os commits param de levar arquivos e linhas da org que ninguém escreveu.

## Perguntas comuns

**Por que não só o commit limpo?**
Porque muitas vezes o commit é feito por outra ferramenta, que roda `git add -A`. Limpando a pasta, qualquer ferramenta commita só o seu.

## Onde se encaixa

Entre o retrieve e o commit, junto com o [commit](./commit.pt-BR.md).
