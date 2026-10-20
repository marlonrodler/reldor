<p align="center"><strong>Português</strong> · <a href="./GLOSSARY.en.md">English</a></p>

# Glossário

Os termos que o Reldor usa, sempre com o mesmo sentido.

| Termo | Em inglês | Significado |
|---|---|---|
| **Núcleo** | Core | Parte genérica do Reldor; não conhece nenhuma tecnologia. |
| **Módulo** | Module | Tudo de uma tecnologia (`modules/sf` para Salesforce). |
| **Índice** | Index | Sumário dos metadados: nomes e ligações, nunca registros nem código. |
| **Cadeia** | Chain | Classes alcançadas a partir de uma trigger, passando pela fábrica `Application` do fflib. |
| **Ordem de execução** | Order of execution | A sequência que o Salesforce segue ao salvar um registro, como o `explain` mostra. |
| **Cascata** | Cascade | Salvar o filho recalcula e salva o pai (roll-up). |
| **Bypass** | Bypass switch | Custom setting ou custom metadata que o código lê para desligar automações. |
| **Certeza** | Certainty | certo · provável · possível (só em texto). |
| **Conselheiro** | Advisor | Skill que entra antes do código, com uma pergunta e sem bloquear. |
| **Cadeia de ambientes** | Environment chain | Branches na ordem de promoção, por exemplo develop → uat → produção. |
| **Commit limpo** | Clean commit | Commit só com as linhas do dev, não o que veio do retrieve. |
| **Ensaio de promoção** | Promotion rehearsal | Merge simulado que mostra conflitos, dependências faltando e ordem dos commits antes do PR. |
| **Perfil do projeto** | Profile (project) | `.reldor/profile.md`: framework, padrões e regras do time, versionado no repositório do cliente. |
| **Capacidade** | Capability | Uma coisa que o Reldor sabe fazer (ordenar XML, rodar o Code Analyzer, rodar testes...), com um nome no `reldor tools`. |
| **Ferramentas do time** | Team tools | O que outra ferramenta já faz no projeto; para cada capacidade, o Reldor faz (`run`), só confere (`verify`) ou fica de fora (`skip`). |
| **Registro de execuções** | Run ledger | O resultado guardado de cada checagem pelo conteúdo que ela leu, para a mesma checagem não rodar duas vezes. |
