<p align="center"><strong>Português</strong> · <a href="./commit.en.md">English</a></p>

# commit

## O que faz

O `commit` prepara um **commit limpo**: só o que você mudou, nunca o que um retrieve trouxe da org. Ele trabalha com uma **foto** tirada logo depois do retrieve. Tudo o que está na pasta nesse momento conta como "veio da org"; só o que você mudar depois conta como seu.

Ele trabalha **linha a linha**. Se o retrieve mudou uma classe e você mudou outras linhas da mesma classe, só as suas linhas entram; as linhas da org ficam na pasta, fora do commit. Se as suas linhas encostarem nas linhas da org, o arquivo fica de fora e o Reldor avisa, para você decidir.

**O Reldor não commita.** Com a execução desligada (o padrão), o `reldor commit` grava as suas linhas num patch (`.reldor/work/commit/so-o-seu.patch`, já conferido contra o seu repositório) e mostra três comandos para você rodar:

```bash
git restore --staged .                                                      # começa com o stage vazio
git apply --cached --3way --whitespace=nowarn .reldor/work/commit/so-o-seu.patch   # só as suas linhas no stage
git commit -m "mensagem"                                                    # ou commite pela sua ferramenta
```

Não rode `git add -A` antes do commit: ele juntaria tudo de novo.

O `retrieve` também não roda nada na org: ele escolhe a org (a do `--org`, a do ambiente ou a de referência), avisa quando há trabalho não commitado que o retrieve poderia sobrescrever e mostra o `sf project retrieve start` pronto, seguido de `reldor snapshot` para tirar a foto. Um retrieve de metadados **específicos** (`--metadata`) conta como seu, porque foi você quem pediu, e não precisa da foto.

O `hook install` coloca um gancho pre-commit em `.git/hooks`, depois de pedir a sua confirmação. Ele roda em **todo** commit, inclusive nos feitos na mão, e barra duas coisas: entradas duplicadas em profiles, permission sets e outros XMLs, e arquivos que só vieram da org.

Com `execute: on` na configuração, o `reldor commit -m "..."` e o `retrieve` rodam os comandos, sempre pedindo confirmação.

## Quando usar

Diga "quero commitar" e a IA roda por você: primeiro o `--dry-run` para mostrar "seus / só suas linhas / da org", depois o `reldor commit`, e te passa os comandos. No terminal: `reldor retrieve`, rode o que ele mostrar, desenvolva, e depois `reldor commit -m "mensagem"`. Instale o gancho uma vez por projeto com `reldor hook install`.

## Está funcionando se

- Os pull requests param de levar metadados que ninguém da task mexeu.
- Você nunca mais perde uma tarde tirando um retrieve de dentro de um commit.

## Perguntas comuns

**Eu fiz o retrieve direto pelo sf CLI.**
Rode `reldor snapshot` logo depois. Tudo o que estiver na pasta nesse momento conta como da org.

**Preciso de um arquivo inteiro que veio da org.**
`reldor commit -m "..." --include caminho/do/arquivo`.

**O gancho barrou algo que eu quero mesmo commitar.**
Corrija o que ele aponta, ou use `git commit --no-verify` quando for intencional.

**O que acontece com as mudanças da org depois do commit?**
Ficam na sua pasta, fora do Git. Descarte com `git restore <arquivo>` se não precisar delas.

**O time já tem um gancho de commit (husky, core.hooksPath).**
O `hook install` mantém um `pre-commit` que já existia e roda ele antes. Com `core.hooksPath`, ele não mexe nos ganchos do time e mostra a linha para acrescentar. Se o gancho do time já faz o mesmo trabalho, grave `pre-commit: skip` (ou `xml-duplicates: verify`) no [`tools`](./tools.md).

## Onde se encaixa

Fica entre o desenvolvimento e a promoção: retrieve → desenvolver → [test-radar](./test-radar.md) → [xml](./xml.md) → commit → [deploy](./deploy.md) na sandbox, se for o caso.
