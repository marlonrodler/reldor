<p align="center"><a href="./GLOSSARY.md">Português</a> · <strong>English</strong></p>

# Glossary

The terms Reldor uses, always with the same meaning.

| Term | In Portuguese | Meaning |
|---|---|---|
| **Core** | Núcleo | Generic part of Reldor; knows nothing about a technology. |
| **Module** | Módulo | Everything about one technology (`modules/sf` for Salesforce). |
| **Index** | Índice | Summary of the project's metadata: names and links, never records or code bodies. |
| **Chain** | Cadeia | Classes reached from a trigger, through the fflib `Application` factory. |
| **Order of execution** | Ordem de execução | The sequence Salesforce follows when a record is saved, as `explain` shows it. |
| **Cascade** | Cascata | A child save that recalculates and saves its parent (roll-up). |
| **Bypass switch** | Bypass | Custom setting or custom metadata the code reads to turn automations off. |
| **Certainty** | Certeza | certain · likely · possible (text only). |
| **Advisor** | Conselheiro | A skill that steps in before code, with one question and no blocking. |
| **Environment chain** | Cadeia de ambientes | Branches in promotion order, for example develop → uat → production. |
| **Clean commit** | Commit limpo | A commit with only the developer's lines, not what a retrieve brought. |
| **Promotion rehearsal** | Ensaio de promoção | A simulated merge that shows conflicts, missing dependencies and commit order before the PR. |
| **Profile (project)** | Perfil do projeto | `.reldor/profile.md`: framework, patterns and team rules, versioned in the client's repo. |
| **Capability** | Capacidade | One thing Reldor can do (sort XML, run the Code Analyzer, run tests...), with a name in `reldor tools`. |
| **Team tools** | Ferramentas do time | What another tool already does in the project; for each capability, Reldor does it (`run`), only checks (`verify`) or stays out (`skip`). |
| **Run ledger** | Registro de execuções | Each check's stored result, by the content it read, so the same check does not run twice. |
