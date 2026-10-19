<p align="center"><strong>Português</strong> · <a href="./xml.en.md">English</a></p>

# xml

## O que faz

O `xml` organiza os XMLs de metadado do jeito que o Salesforce faz no retrieve: entradas ordenadas pela chave e duplicados idênticos removidos. Ele cobre profiles, permission sets, muting permission sets, custom labels, traduções, sharing rules, global e standard value sets, traduções de objeto e `package.xml`. Os valores de picklist mantêm a ordem, porque a ordem é o que o usuário vê.

Ele só mexe nas seções que conhece e mantém o texto exato do resto, então o diff mostra só o que mudou de verdade. Duas entradas com a mesma chave e valores **diferentes** (por exemplo, o mesmo campo uma vez só leitura e outra editável) são um **conflito**: o Reldor deixa as duas e pede para você decidir, porque adivinhar uma permissão não é seguro.

Arquivos ordenados também deixam os merges entre ambientes mais tranquilos: menos linhas mudam de lugar, então o Git acha menos conflitos falsos.

## Quando usar

Antes de um commit (a IA roda nos arquivos que você mudou), ou uma vez com `reldor xml --all` para limpar um projeto. O `reldor xml --check` só aponta; o gancho pre-commit usa ele.

## Está funcionando se

- Os deploys param de falhar com "Duplicate value found".
- Os diffs de profiles e permission sets mostram só as mudanças reais.

## Perguntas comuns

**Ele mexe em layouts ou flows?**
Não. A ordem deles tem significado, então ficam como estão.

## Onde se encaixa

Roda antes do [commit](./commit.md) e dentro do gancho pre-commit.
