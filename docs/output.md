<p align="center"><strong>Português</strong> · <a href="./output.en.md">English</a></p>

# output

## O que faz

Toda resposta de um comando do Reldor também fica guardada num arquivo, em `.reldor/work/output/` (fora do Git):

- um arquivo por comando, sempre sobrescrito: `status.json` (com `--json`) ou `status.txt`;
- **somem sozinhos** quando a tarefa ou a fase dela muda (refinar → desenvolver → promover), e os que têm mais de 7 dias;
- nada é perguntado antes de apagar: são só cópias das respostas. O `refine.json` da tarefa não fica aqui e não é apagado.

**`reldor output`** lista os arquivos guardados; **`reldor output --clear`** apaga todos na hora.

No fim de cada comando, num terminal de IDE (VS Code, Kiro), o Reldor também manda o sinal invisível de "comando
terminou" que esses terminais entendem. Num terminal sem esse recurso (cmd, PowerShell restrito), é o que evita a IA ficar
esperando. Para desligar: `RELDOR_NO_TERMINAL_SIGNAL=1`.

## Quando usar

Você quase nunca usa: é para a IA. Se o terminal da IDE devolver o comando misturado (`reldorreldor`) ou não mostrar a
resposta, a IA lê `.reldor/work/output/<comando>.json` em vez de rodar de novo. Pelo MCP a resposta já vai direto para a
IA, então nada é guardado.

## Está funcionando se

- Depois de `reldor status --json`, existe `.reldor/work/output/status.json`.
- Depois de trocar de tarefa, a pasta começa vazia de novo.

## Onde se encaixa

Por trás de todos os comandos. O `--out <arquivo>` continua existindo para quem quer escolher o arquivo.
