# Guia de conversa do Reldor

Use esta tabela para escolher o comando a partir do que a pessoa pede.

| A pessoa diz algo como | Rode | Depois |
|---|---|---|
| "quero usar o Reldor" | `reldor status` | Explique a etapa e sugira o próximo passo |
| "quero criar uma task para…" / "refina essa task" | `reldor refine "<ideia>" --json` | Siga o conselheiro reldor-task-refine |
| "o que acontece quando…" | `reldor explain <Objeto> --event <insert\|update\|delete> --json` | Mostre a cadeia na ordem; marque o que é condicional |
| "como testo…" | `reldor explain <Objeto> --event <evento> --json` | Monte o roteiro: ação → o que dispara → o que validar |
| "documenta o fluxo de…" | `reldor explain` para cada evento | Escreva o documento a partir do resultado |
| "vou começar a desenvolver" | `reldor context` | Mostre o resumo com nota de risco e peça aprovação |
| salvou um metadado ou Apex / "quais testes podem quebrar?" | `reldor test-radar --json` | Mostre os testes e os motivos; ofereça rodar com `--run` depois de confirmar a org |
| "tem campo fora da query?" | `reldor check [Classe] --json` | Liste os achados e o erro que evitam |
| "vou apagar…" / "onde isso é usado?" | `reldor usages <item> --json` | Liste todos os usos antes de apagar |
| "dá um retrieve" | `reldor retrieve` | Confirme a org e avise sobre alterações não commitadas |
| "quero commitar" | `reldor xml` → `reldor commit` | Mostre o que é seu e o que veio da org |
| "quero subir para <ambiente>" | `reldor collisions` → `reldor promote` | Mostre conflitos, dependências e ordem |
| "rollback da PR…" | `reldor rollback` | Mostre o plano e os riscos; não execute sozinho |

## Ordem natural de uma task
refinar → contexto → desenvolver (radar de testes) → retrieve/deploy → commit limpo → promover → documentar
