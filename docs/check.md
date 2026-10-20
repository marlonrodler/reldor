<p align="center"><strong>Português</strong> · <a href="./check.en.md">English</a></p>

# check

## O que faz

O `check` roda a checagem de queries no projeto inteiro, ou nas classes que você informar: campos customizados lidos de registros que a classe consultou, mas que faltam na SOQL ou no selector que ela usa. Cada achado é **provável**, ou **possível** quando a classe também monta queries em tempo de execução (`Database.query`).

Classes que recebem registros por parâmetro ou do `Trigger.new` ficam de fora, porque os campos delas não podem ser julgados pelo código.

## Quando usar

Rode `reldor check` uma vez num projeto para achar problemas antigos, ou `reldor check MinhaClasse` enquanto trabalha. O `test-radar` já roda essa checagem nas classes que você alterou.

## Perguntas comuns

**O mesmo que o review faz?**
Sim: o `review` já inclui esta checagem. Com o mesmo conteúdo e as mesmas classes, o resultado é reaproveitado, então rodar os dois não repete o trabalho.

## Onde se encaixa

É a metade estática do [test-radar](./test-radar.md).
