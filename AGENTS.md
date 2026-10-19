<p align="center"><strong>Português</strong> · <a href="./AGENTS.en.md">English</a></p>

# Trabalhando no Reldor

Regras para qualquer agente (ou pessoa) que mude este repositório.

## A regra do produto
Scripts fazem o trabalho pesado e confiável; a IA só interpreta e explica. Uma funcionalidade que precisa de fatos sobre
a org (automações, referências, conflitos) calcula esses fatos em `core/` ou `modules/`, nunca num `SKILL.md`.

## Nunca coloque um cliente no Reldor
Nada de nomes de cliente, nomes de ferramentas internas, nomes de times, nomes de branch, apelidos de org ou trechos de
código de um cliente real neste repositório: nem no código, nem na documentação, nos testes, nos exemplos ou nas mensagens
de commit. O que é do cliente fica na pasta `.reldor/` do próprio cliente. Os exemplos usam nomes inventados.

## Organização
- `core/`: genérico, não sabe nada de Salesforce. Os módulos entram por `core/modules/index.js`
  (contrato: `name`, `label`, `matches`, `detect`, `statusLines`, `profileLines` e o opcional `doctorChecks`).
- `modules/sf/`: tudo de Salesforce. Os conselheiros são skills em `modules/sf/advisors/<nome>/SKILL.md`.
- `skills/`: skills do núcleo. `skills/reldor` é o roteador.
- `.claude-plugin/plugin.json` lista todas as skills publicadas. `adapters/kiro/plugin.json` é o manifesto do Kiro;
  `npm run build:adapters` grava o plugin pronto do Kiro em `plugins/kiro/reldor` (vai no commit; um teste confere se está
  atualizado).

## Documentação: sempre em português e em inglês
Todo documento tem duas versões: `<nome>.md` em **português** (a principal) e `<nome>.en.md` em **inglês**. As duas abrem
com o seletor de idioma, Português primeiro. Vale para o README, o CHANGELOG, o glossário, este arquivo, `docs/`, as ADRs
e os conselheiros. As skills (`SKILL.md`) são instruções para a IA e ficam numa versão só.

## Toda funcionalidade nova ou alterada
1. Código e testes (`npm test` precisa passar; o projeto de exemplo fica em `test/fixtures/sample-sf`).
2. Uma página em `docs/<nome>.md` e `docs/<nome>.en.md`. Seções: O que faz, Quando usar, Está funcionando se, Perguntas
   comuns (quando houver de verdade), Onde se encaixa.
3. Uma linha na Referência do `README.md` e do `README.en.md`.
4. Uma skill nova também entra em `.claude-plugin/plugin.json` (`test/repo.test.js` confere).
5. Se entrou um comando, atualize `skills/reldor/SKILL.md` ("Comandos disponíveis hoje") e `skills/reldor/guide.md`.
6. Uma linha no `CHANGELOG.md` e no `CHANGELOG.en.md`. Suba a versão do `package.json` e do `.claude-plugin/plugin.json`
   juntas, e rode `npm run build:adapters`.

## Escrita
- As skills respondem no idioma da conversa (ou no `language` da configuração do cliente), curtas e didáticas: resumo
  primeiro, detalhes depois.
- Os termos seguem o [GLOSSÁRIO](./GLOSSARY.md).
- Código: identificadores em inglês, um comentário curto antes de cada função, compatível com Windows (use
  `core/util/exec.js`).
- Decisões grandes ganham uma ADR em `docs/adr/`.
