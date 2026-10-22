<p align="center"><strong>Português</strong> · <a href="./teams.en.md">English</a></p>

# teams

## O que faz

Diz ao Reldor como o nome de uma classe, objeto ou campo mostra o time dono. Cada empresa faz de um jeito: `VND_Pedido`,
`PedidoVND`, `OpportunityVendasService`, `vnd-tela`, ou uma pasta por time. Por isso o Reldor **nunca adivinha**: ele só
sugere e você confirma.

- **`reldor teams`** mostra os times confirmados e as **sugestões**: palavras que se repetem em muitos nomes, em qualquer
  posição, com ou sem separador (papéis como `Service`, `Selector` e nomes do Salesforce ficam de fora). Para cada uma,
  quantos nomes, exemplos e onde ela costuma ficar (começo, fim ou no meio).
- **`reldor teams add <nome> --match <palavra> [--where start|end]`** confirma um time pela palavra do nome. Sem `--where`,
  vale em qualquer posição. Para casos especiais: `--regex "<expressão>"` ou `--folder <parte do caminho>`.
- **`reldor teams remove <nome>`** tira um time.

Os times ficam em `teams:` no `.reldor/reldor.config.yaml` (vai no Git: vale para o time todo). O seu time fica só na sua
máquina, com `reldor me --team <nome>`.

```yaml
teams:
  - name: Vendas
    match: vnd
    where: start
  - name: Campanhas
    folder: force-app/campanhas
```

## Quando usar

Uma vez por projeto, depois do `init`. A IA mostra as sugestões e pergunta qual palavra marca qual time. Sem times
confirmados, nada é atribuído a time nenhum: o [`helpers`](./helpers.md) trata tudo como compartilhado e o `refine` não
avisa "isto é de outro time".

## Está funcionando se

- `reldor teams` lista os seus times com o número de classes, objetos e campos de cada um.
- O `profile.md` mostra "Times e código compartilhado" com os times certos.
- No `refine`, um campo de outro time aparece como "de outro time", não como seu.

## Perguntas comuns

**A sugestão trouxe uma palavra que não é time** (ex.: o nome de um produto).
É só não confirmar. Sugestão não muda nada.

**Um nome tem a palavra de dois times.**
Vale o primeiro time da lista que casar.

## Onde se encaixa

Configuração do projeto, junto com o [`init`](./init.md). Alimenta o [`helpers`](./helpers.md), o [`refine`](./refine.md)
e o `profile.md`.
