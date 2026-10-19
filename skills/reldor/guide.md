# Guia de conversa do Reldor

Use esta tabela para escolher o comando a partir do que a pessoa pede.

| A pessoa diz algo como | Rode | Depois |
|---|---|---|
| "quero usar o Reldor" | `reldor status` | Explique a etapa e sugira o próximo passo |
| "instalei o Reldor, e agora?" / "não está funcionando" | `reldor doctor --json` | O que falta, com o comando que resolve, e o `next` |
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
| "posso commitar?" / antes de commitar | `reldor review --json` | 🔴 primeiro, depois 🟡, depois os testes |
| "tem algum problema de segurança?" | `reldor security --json` | Prioridade alta primeiro, com como corrigir |
| "repeti algum código?" | `reldor quality --json` | Onde está o original e como reaproveitar |
| "organiza os profiles" | `reldor xml [--all]` | Mostre duplicados removidos e conflitos para decidir |
| "quero subir para <ambiente>" | `reldor promote <ambiente> --fetch --json` | Problemas primeiro (ordem, dependências, conflitos), depois o próximo passo |
| "deu conflito em profile" / antes do primeiro merge | `reldor merge status` → `reldor merge install` | Explique que é só na máquina da pessoa |
| "rollback da PR…" | `reldor rollback <n> --fetch --json` | Riscos primeiro (itens ainda usados, arquivos mudados depois); não execute sozinho |
| "muda os ambientes" / "qual é a cadeia?" | `reldor env --json` / `reldor env set "nome:branch, ..."` | A cadeia na ordem, qual é produção, de onde nascem as branches |
| "vou commitar" / "limpa o que não é meu" | `reldor clean --dry-run --json` → `reldor clean --yes` | O que sai, o que fica, como desfazer |
| "faz o merge da minha branch" (na branch de merge) | `reldor merge <branch> --yes --json` → resolver `hard` → `reldor merge --check` | O que foi resolvido, o que revisar, "entrou só o seu?" |

## Ordem natural de uma task
refinar → contexto → desenvolver (radar de testes) → retrieve/deploy → commit limpo → promover → documentar
