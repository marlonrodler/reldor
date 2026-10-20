<p align="center"><strong>Português</strong> · <a href="./doctor.en.md">English</a></p>

# doctor

## O que faz

O `doctor` confere se está tudo pronto para usar o Reldor **na pasta em que o terminal está** e diz um único próximo passo. Ele não muda nada, só olha:

- **No computador:** Node.js (18 ou mais novo), Git, Salesforce CLI, e os opcionais (Code Analyzer, GitHub CLI). Também mostra onde o Reldor está instalado e o comando para atualizar.
- **Na IA:** se achou o plugin do Reldor no Kiro ou no Claude Code.
- **Nesta pasta:** se é um projeto Salesforce, a org padrão do projeto, se é um repositório Git, se o Reldor já foi configurado e se há sinais de ferramentas do time ainda não decididos (veja o [`tools`](./tools.md)). Avisa quando o terminal está na pasta do próprio Reldor em vez da pasta do projeto.

## Quando usar

Logo depois de instalar, e sempre que algo não funcionar. Abra a pasta do projeto no VS Code, abra o terminal (**Terminal → New Terminal**) e rode `reldor doctor`. A IA também pode rodar `reldor doctor --json` quando um comando falhar.

## Está funcionando se

- Termina com "Tudo pronto" ou com um passo que você consegue seguir sem procurar mais nada.
- Cada item que falta vem com o comando que resolve.

## Perguntas comuns

**Ele diz que não achou o plugin, mas eu instalei.**
A procura é por pastas conhecidas do Kiro e do Claude Code. Se a sua IA já conhece o Reldor (responde a "quero usar o Reldor"), pode ignorar esse aviso.

**Ele diz que a pasta é sincronizada (OneDrive).**
O Reldor foi clonado numa pasta do OneDrive, e a sincronização deixa tudo mais lento. Instale pelo npm (`npm install -g github:marlonrodler/reldor`) e apague a pasta clonada.

**Ele diz que encontrou ferramentas do time.**
O projeto tem sinais de ferramentas que fazem parte do trabalho do Reldor (um gancho, a esteira, instruções da IA). Rode `reldor tools` para ver e decidir quem cuida de cada coisa.

## Onde se encaixa

É o primeiro comando depois da instalação. Quando ele disser "tudo instalado", o próximo é conversar com a IA: "quero usar o Reldor", que roda o [`init`](./init.md).
