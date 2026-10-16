<p align="center"><a href="./security.md">English</a> · <strong>Português</strong></p>

# security

## O que faz

O `security` revisa os arquivos que a sua feature mudou (ou o projeto inteiro com `--all`) e lista os problemas de segurança por prioridade, cada um com o arquivo, a linha e como corrigir. Ele junta as regras do próprio Reldor com as regras de segurança do **Salesforce Code Analyzer** oficial, quando ele está instalado (`sf plugins install code-analyzer`).

| Risco | O que ele procura |
|---|---|
| SOQL injection | Query dinâmica que concatena um valor vindo de fora do método, sem bind nem `escapeSingleQuotes` |
| CRUD/FLS | Métodos chamados por tela, API ou flow que leem ou gravam sem `USER_MODE`, `as user` ou `stripInaccessible` |
| Sharing | Classes de entrada sem declaração de sharing, ou `without sharing` |
| Dado sensível no log | `System.debug` com CPF, conta, saldo, token... (a lista é configurável) |
| Segredos e endpoints | Token ou senha no código, endpoint fora de Named Credential, callout por `http://` |
| Criptografia fraca | MD5 e SHA1 |
| IDs fixos | IDs de registro escritos no código |
| LWC e Visualforce | `innerHTML`, `eval`, `lwc:dom="manual"`, `escape="false"`, merge field em script sem `JSENCODE` |
| Flows | Flows que rodam em modo sistema sem sharing, pior quando são telas |
| Acesso de convidado | Profiles de usuário convidado que podem editar, apagar ou ver todos os registros |

Ele também segue o **caminho**: um método chamado de fora que chega, pela cadeia de chamadas, numa classe `without sharing` que lê ou grava dados. Um scanner arquivo por arquivo não enxerga isso, porque cada arquivo parece certo sozinho.

## Quando usar

A IA roda antes de commitar Apex, LWC, Visualforce, flows ou profiles. Diga "tem algum problema de segurança?" ou rode `reldor security`. O `--fail-on alta` faz o comando dar erro quando houver achado de prioridade alta, para scripts.

## Está funcionando se

- Os achados de prioridade alta são corrigidos antes do pull request, e não encontrados depois por outra pessoa.
- Os logs param de carregar dado de cliente.

## Perguntas comuns

**Um achado é intencional.**
Coloque `// reldor-ignore: <regra>` na linha ou na linha de cima, com um comentário dizendo por quê. Para CRUD, o `@SuppressWarnings('PMD.ApexCRUDViolation')` também é respeitado.

**Substitui pentest ou a equipe de segurança?**
Não. Ele pega os erros comuns cedo, enquanto o código ainda está na sua máquina.

## Onde se encaixa

Antes do [commit](./commit.pt-BR.md), ao lado do [test-radar](./test-radar.pt-BR.md). Usa o mesmo índice do [explain](./explain.pt-BR.md) para seguir o caminho.
