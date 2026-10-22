<p align="center"><strong>Português</strong> · <a href="./helpers.en.md">English</a></p>

# helpers e me

## O que faz

**`reldor helpers <termo>`** mostra os métodos públicos que **já existem** para aquilo, antes de você (ou a IA) escrever outro. Ele procura pelas palavras no nome do método, no nome da classe e nos parâmetros, e mostra primeiro o **código compartilhado** (classes que não são de nenhum time confirmado, como `StringUtils` ou um Selector), depois o que está em classes de times, com a assinatura e o arquivo:linha.

**`reldor helpers --similar`** mostra métodos com o mesmo nome em **times diferentes**: dois times escreveram a mesma coisa. Cada grupo é candidato a virar um método só, genérico, numa classe compartilhada. Métodos que se repetem de propósito (a mesma classe base ou a mesma interface) ficam de fora.

**`reldor me --team <nome>`** guarda o seu time **só na sua máquina** (`.reldor/local.yaml`, que fica no `.gitignore`).

Quem é dono de cada nome vem só dos **times confirmados** do projeto ([`reldor teams`](./teams.md)). O Reldor não adivinha: cada empresa marca o time de um jeito (no começo, no meio ou no fim do nome, com ou sem `_`, por pasta). Sem times confirmados, o `--similar` compara classes, sem dizer de quem é cada uma. Tudo vem do índice do projeto: nada de org, nada de IA.

## Quando usar

A IA usa sozinha antes de criar um método: "precisa de um método que formata CPF" → `reldor helpers formatar cpf`. Se já existe no compartilhado, ela usa esse. Se só existe na classe de outro time, ela propõe levar para o compartilhado em vez de copiar. Se não existe e outra área pode precisar, ela propõe um método **genérico**: o que muda vira parâmetro (o objeto, o campo, os Ids, as opções), numa classe compartilhada.

No terminal: `reldor helpers formatar`, `reldor helpers --similar`, `reldor me`, `reldor me --team vendas`.

## Está funcionando se

- Os times param de criar o mesmo método cada um com o seu prefixo.
- Quem chega num time novo acha o helper que já existe em vez de escrever outro.

## Perguntas comuns

**O nosso time não usa prefixo.**
Então não confirme times: tudo aparece como compartilhado, e o `helpers` continua achando os métodos que já existem. Se o time aparece pela pasta, use `reldor teams add <nome> --folder <pasta>`.

**Por que o meu time não vai para o profile.md?**
Porque o `profile.md` é do time todo, e cada pessoa está num time. O seu fica no `.reldor/local.yaml`, fora do Git.

## Onde se encaixa

Durante o desenvolvimento, antes de escrever código novo. Os padrões que a IA segue estão no [`profile.md`](./init.md#o-profilemd); a cópia que escapar aparece no [`quality`](./quality.md).
