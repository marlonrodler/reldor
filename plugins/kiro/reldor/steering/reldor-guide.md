# Guia de conversa do Reldor

Use esta tabela para escolher o comando a partir do que a pessoa pede.

| A pessoa diz algo como | Rode | Depois |
|---|---|---|
| "quero usar o Reldor" | `reldor status` (e `reldor init`, se não estiver configurado) | Explique a etapa e sugira o próximo passo; não pergunte branches nem org |
| "me ajude a preencher o profile" | `reldor profile --json` | O que foi encontrado; pergunte um tópico por vez e escreva só em "Padrões da equipe" |
| "instalei o Reldor, e agora?" / "não está funcionando" | `reldor doctor --json` | O que falta, com o comando que resolve, e o `next` |
| "já existe um método para…?" / antes de criar um método | `reldor helpers <palavras> --json` | Compartilhado primeiro; se não existir, proponha um método genérico |
| "meu time é…" | `reldor me --team <nome> --prefix <PREFIXO>` (com o "sim") | O que é do time, exemplos do padrão, o que é compartilhado |
| "onde os times repetem código?" | `reldor helpers --similar --json` | Cada grupo vira candidato a um método genérico |
| "quero criar uma task para…" / "refina essa task" | `reldor refine "<ideia>" --json` | Siga o conselheiro reldor-task-refine |
| "o que acontece quando…" | `reldor explain <Objeto> --event <insert\|update\|delete> --json` | Mostre a cadeia na ordem; marque o que é condicional |
| "como testo…" | `reldor explain <Objeto> --event <evento> --json` | Monte o roteiro: ação → o que dispara → o que validar |
| "documenta o fluxo de…" | `reldor explain` para cada evento | Escreva o documento a partir do resultado |
| "vou começar a desenvolver" | `reldor explain <Objeto> --json` para cada objeto que muda, e `reldor usages <item> --json` para o que vai ser alterado | Mostre o que já roda no objeto e onde o item é usado; aponte os riscos e peça aprovação |
| salvou um metadado ou Apex / "quais testes podem quebrar?" | `reldor test-radar --json` | Mostre os testes e os motivos; com a org, `--run --org <alias> --json` devolve o comando para a pessoa rodar |
| "tem campo fora da query?" | `reldor check [Classe] --json` | Liste os achados e o erro que evitam |
| "vou apagar…" / "onde isso é usado?" | `reldor usages <item> --json` | Liste todos os usos antes de apagar |
| "dá um retrieve" | `reldor retrieve [--metadata X] --org <alias> --json` (pergunte a org) | Mostre os comandos para a pessoa rodar; diga se o que vier conta como seu ou da org |
| "fiz retrieve por fora" | `reldor snapshot` | Explique que o que está na pasta agora conta como da org |
| "quero commitar" | `reldor xml` (com o "sim", `--yes`) → `reldor commit --dry-run --json` → `reldor commit -m "..." --json` | O que é seu, o que é misto e o que veio da org; depois os comandos para a pessoa rodar |
| "posso commitar?" / antes de commitar | `reldor review --json` | 🔴 primeiro, depois 🟡, depois os testes |
| "tem algum problema de segurança?" | `reldor security --json` | Prioridade alta primeiro, com como corrigir |
| "repeti algum código?" | `reldor quality --json` | Onde está o original e como reaproveitar |
| "organiza os profiles" | `reldor xml [--all]` | Mostre duplicados removidos e conflitos para decidir |
| "quero subir para <ambiente>" | `reldor promote <ambiente> --fetch --json` | Problemas primeiro (ordem, dependências, conflitos), depois o próximo passo |
| "deu conflito em profile" / antes do primeiro merge | `reldor merge status` → `reldor merge install --yes` (com o "sim") | Explique que é só na máquina da pessoa |
| "rollback da PR…" | `reldor rollback <n> --fetch --json` | Riscos primeiro (itens ainda usados, arquivos mudados depois); o passo a passo é para a pessoa rodar |
| "monta o deploy" / "sobe para a sandbox" | `reldor deploy [ambiente] [--org <alias>] --json` | Validação primeiro, depois o quick deploy; nunca rode, mostre os comandos |
| "a gente já tem uma ferramenta que faz…" / "não quero que o Reldor repita…" | `reldor tools --json` → `reldor tools set <capacidade> <run\|verify\|skip> --owner "<ferramenta>"` (com confirmação) | Quem cuida de cada coisa; o que o Reldor só confere e o que fica de fora |
| "muda os ambientes" / "qual é a cadeia?" / "a org é tal" | `reldor env --json` / `reldor env set "nome:branch, ..."` / `reldor env --org <alias>` | A cadeia na ordem, qual é produção, a org de referência |
| "vou commitar" / "limpa o que não é meu" | `reldor clean --dry-run --json` → `reldor clean --json` | O que sai, o que fica, os comandos para a pessoa rodar, como desfazer |
| "faz o merge da minha branch" (na branch de merge) | `reldor merge <branch> --json` → a pessoa roda o `git merge` → `reldor merge --resolve --yes --json` (com o "sim") → resolver `hard` → `reldor merge --check` | O que foi resolvido, o que revisar, "entrou só o seu?" |

## Ordem natural de uma task
refinar → entender (explain, usages) → desenvolver (radar de testes) → revisar (review) → limpar (clean) → commit pela pessoa ou pela ferramenta do time → deploy na sandbox (comandos do `reldor deploy`) → promover (promote) → documentar

O Reldor não executa nada no Git nem na org: ele confere e monta os comandos, e quem roda é a pessoa ou a esteira.
