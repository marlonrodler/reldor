<p align="center"><strong>Português</strong> · <a href="./xml.en.md">English</a></p>

# xml

## O que faz

O `xml` organiza os XMLs de metadado do jeito que o Salesforce faz no retrieve: entradas ordenadas pela chave e duplicados idênticos removidos. Ele cobre profiles, permission sets, muting permission sets, custom labels, traduções, sharing rules, global e standard value sets, traduções de objeto e `package.xml`. Os valores de picklist mantêm a ordem, porque a ordem é o que o usuário vê.

Ele só mexe nas seções que conhece e mantém o texto exato do resto, então o diff mostra só o que mudou de verdade. Duas entradas com a mesma chave e valores **diferentes** (por exemplo, o mesmo campo uma vez só leitura e outra editável) são um **conflito**: o Reldor deixa as duas e pede para você decidir, porque adivinhar uma permissão não é seguro.

Arquivos ordenados também deixam os merges entre ambientes mais tranquilos: menos linhas mudam de lugar, então o Git acha menos conflitos falsos.

## Quando usar

Antes de um commit (a IA roda nos arquivos que você mudou), ou uma vez com `reldor xml --all` para limpar um projeto. Antes de reescrever, ele mostra os arquivos e pede confirmação (para a IA, `--yes` só depois que você disser sim). O `reldor xml --check` só aponta, sem mudar nada. O gancho pre-commit confere os duplicados (a ordem não barra commit).

## Está funcionando se

- Os deploys param de falhar com "Duplicate value found".
- Os diffs de profiles e permission sets mostram só as mudanças reais.

## Perguntas comuns

**Ele mexe em layouts ou flows?**
Não. A ordem deles tem significado, então ficam como estão.

**Outra ferramenta do time já ordena ou tira duplicados.**
Diga isso no [`tools`](./tools.md) (`xml-duplicates` e `xml-order`). Com `verify`, o `reldor xml` não reescreve nada: só confere e, se faltar algo, diz qual ferramenta rodar; o `review` e o gancho continuam garantindo que nenhum duplicado chegue ao commit. Com `skip`, o Reldor fica de fora. Para o Reldor organizar mesmo assim: `reldor xml --force`. O mesmo arquivo com o mesmo conteúdo é conferido uma vez só.

## Onde se encaixa

Roda antes do [commit](./commit.md); a checagem de duplicados também roda dentro do gancho pre-commit.
