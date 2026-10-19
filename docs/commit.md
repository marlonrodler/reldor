<p align="center"><strong>Português</strong> · <a href="./commit.en.md">English</a></p>

# commit

## O que faz

O `commit` faz um **commit limpo**: só o que você mudou, nunca o que um retrieve trouxe da org. Ele trabalha com uma **foto** tirada logo depois do retrieve. Tudo o que está na pasta nesse momento conta como "veio da org"; só o que você mudar depois conta como seu.

Ele trabalha **linha a linha**. Se o retrieve mudou uma classe e você mudou outras linhas da mesma classe, só as suas linhas entram no commit; as linhas da org ficam na pasta, fora do commit. Se as suas linhas encostarem nas linhas da org, o arquivo fica de fora e o Reldor avisa, para você decidir.

O `retrieve` tira a foto por você: ele confirma a org, avisa quando há trabalho não commitado que o retrieve poderia sobrescrever, e roda o `sf project retrieve start`. Um retrieve de metadados **específicos** (`--metadata`) conta como seu, porque foi você quem pediu.

O `hook install` coloca um gancho pre-commit em `.git/hooks`. Ele roda em **todo** commit, inclusive nos feitos na mão, e barra duas coisas: entradas duplicadas em profiles, permission sets e outros XMLs, e arquivos que só vieram da org.

**Com as ações de Git desligadas** (o padrão, quando outra ferramenta commita por você), o `reldor commit` só mostra o plano. O `reldor commit --stage` deixa só as suas linhas no stage, sem commitar, para a sua ferramenta fazer o commit. Um `git add -A` dessa ferramenta junta tudo de novo.

## Quando usar

Diga "quero commitar" e a IA roda por você: primeiro o `--dry-run` para mostrar "seus / só suas linhas / da org", depois o commit. No terminal: `reldor retrieve`, depois `reldor commit -m "mensagem"`. Instale o gancho uma vez por projeto com `reldor hook install`.

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

## Onde se encaixa

Fica entre o desenvolvimento e a promoção: retrieve → desenvolver → [test-radar](./test-radar.md) → [xml](./xml.md) → commit.
