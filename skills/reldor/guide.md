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
| "dá um retrieve" | `reldor retrieve [--metadata X] --yes --org <alias>` (depois de confirmar a org) | Diga se o que veio conta como seu ou da org |
| "fiz retrieve por fora" | `reldor snapshot` | Explique que o que está na pasta agora conta como da org |
| "quero commitar" | `reldor xml` → `reldor commit --dry-run --json` → `reldor commit -m "..." --yes` | Mostre o que é seu, o que é misto e o que veio da org |
| "tem algum problema de segurança?" / antes de commitar código | `reldor security --json` | Prioridade alta primeiro, com como corrigir |
| "repeti algum código?" / antes de commitar Apex | `reldor quality --json` | Onde está o original e como reaproveitar |
| "organiza os profiles" | `reldor xml [--all]` | Mostre duplicados removidos e conflitos para decidir |
| "quero subir para <ambiente>" | `reldor promote <ambiente> --fetch --json` | Problemas primeiro (ordem, dependências, conflitos), depois o próximo passo |
| "deu conflito em profile" / antes do primeiro merge | `reldor merge status` → `reldor merge install` | Explique que é só na máquina da pessoa |
| "rollback da PR…" | `reldor rollback <n> --fetch --json` | Riscos primeiro (itens ainda usados, arquivos mudados depois); não execute sozinho |
| "alguém mais mexe nisso?" / antes de promover | `reldor collisions --fetch --json` | Risco alto primeiro, com autor e ambiente |

## Ordem natural de uma task
refinar → contexto → desenvolver (radar de testes) → retrieve/deploy → commit limpo → promover → documentar
