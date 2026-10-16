# Guia de conversa do Reldor

Use esta tabela para escolher o comando a partir do que a pessoa pede.

| A pessoa diz algo como | Rode | Depois |
|---|---|---|
| "quero usar o Reldor" | `reldor status` | Explique a etapa e sugira o próximo passo |
| "quero criar uma task para…" | `reldor refine` | Mostre impacto, perguntas em aberto e critérios |
| "o que acontece quando…" | `reldor explain` | Mostre a cadeia na ordem; marque o que é condicional |
| "como testo…" | `reldor explain --test-script` | Entregue o roteiro passo a passo |
| "vou começar a desenvolver" | `reldor context` | Mostre o resumo com nota de risco e peça aprovação |
| salvou um metadado | `reldor test-radar` | Ofereça rodar os testes afetados |
| "vou apagar…" | `reldor usages` | Liste todos os usos antes de apagar |
| "dá um retrieve" | `reldor retrieve` | Confirme a org e avise sobre alterações não commitadas |
| "quero commitar" | `reldor xml` → `reldor commit` | Mostre o que é seu e o que veio da org |
| "quero subir para <ambiente>" | `reldor collisions` → `reldor promote` | Mostre conflitos, dependências e ordem |
| "rollback da PR…" | `reldor rollback` | Mostre o plano e os riscos; não execute sozinho |

## Ordem natural de uma task
refinar → contexto → desenvolver (radar de testes) → retrieve/deploy → commit limpo → promover → documentar
