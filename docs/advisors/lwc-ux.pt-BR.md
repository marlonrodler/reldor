<p align="center"><a href="./lwc-ux.md">English</a> · <strong>Português</strong></p>

# lwc-ux

## O que faz

O `lwc-ux` para antes de um Lightning Web Component ser escrito e propõe dois ou três caminhos de tela, do mais simples ao mais moderno, com prós e contras. Ele procura componentes que já existem para reaproveitar e oferece uma POC visual descartável em `.reldor/work/<task>/poc/`, fora do `force-app`, para nada chegar ao repositório antes da sua escolha.

Todo caminho segue um checklist de qualidade: componentes base e SLDS, Lightning Data Service quando dá para evitar Apex, leitura com cache, estados de carregando, vazio e erro, acessibilidade, celular e paginação em listas longas. O SLDS é o padrão; se o projeto não tiver `design_system` definido, ele pergunta uma vez e grava a resposta.

## Quando usar

A IA usa quando alguém vai criar ou alterar um LWC. Você pode perguntar "como deveria ser essa tela?".

## Está funcionando se

- Você vê opções antes do código.
- As telas param de sair sem estados de carregando e de erro.

## Onde se encaixa

É o par de tela do [automation-design](./automation-design.pt-BR.md).
