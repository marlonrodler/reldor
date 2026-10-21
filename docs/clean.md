<p align="center"><strong>Português</strong> · <a href="./clean.en.md">English</a></p>

# clean

## O que faz

Depois de um retrieve, a pasta mistura o seu trabalho com o que veio da org. O `reldor clean` deixa na pasta **só o que é seu**, antes de qualquer ferramenta commitar:

- arquivos que só a org mudou saem da pasta;
- em arquivos que os dois mudaram, ficam só as suas linhas;
- os seus arquivos ficam como estão.

O que veio da org vai para um stash do Git chamado "reldor clean", então nada se perde.

**O Reldor não mexe no Git sozinho.** Com a execução desligada (o padrão), ele separa as suas linhas num patch (`.reldor/work/clean/so-o-seu.patch`), guarda uma foto de antes e mostra os comandos para você rodar: o patch no stage, o `git stash push --keep-index --include-untracked -m "reldor clean: o que veio da org"`, o stage vazio de novo e o `reldor snapshot --clear`. Com `execute: on`, ele mesmo roda, depois de pedir confirmação.

O `reldor clean --undo` mostra os comandos para trazer de volta o que veio da org (pulando arquivos que você mudou depois da limpeza). O `--dry-run` mostra o plano; o `--include <arquivo>` mantém inteiro um arquivo da org.

Precisa da foto tirada pelo [`reldor retrieve`](./commit.md) (ou do `reldor snapshot` logo depois de um retrieve feito fora do Reldor).

## Quando usar

Na hora de commitar: diga "vou commitar, limpa o que não é meu". A IA roda o `clean` e te passa os comandos. Depois commite pela ferramenta de fluxo do time, por outra ferramenta ou pelo [`reldor commit`](./commit.md).

## Está funcionando se

- Os commits param de levar arquivos e linhas da org que ninguém escreveu.

## Perguntas comuns

**Por que não só o commit limpo?**
Porque muitas vezes o commit é feito por outra ferramenta, que roda `git add -A`. Limpando a pasta, qualquer ferramenta commita só o seu.

**Outra ferramenta já tira da pasta o que veio da org.**
Grave `org-files: skip` (ou `verify`) no [`tools`](./tools.md): o `clean` passa a não mexer na pasta (o `--dry-run` ainda mostra o que sairia; `--force` limpa mesmo assim).

## Onde se encaixa

Entre o retrieve e o commit, junto com o [commit](./commit.md).
