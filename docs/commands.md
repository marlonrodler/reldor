# Comandos

Você não precisa decorar nada: **quem usa estes comandos é a IA**. Eles estão aqui para referência.

| Comando | O que faz | Fase |
|---|---|---|
| `reldor init` | Instala no projeto e pergunta só o que não detecta | 0 |
| `reldor status` | Etapa atual: branch, pendências, ambientes da feature | 0 |
| `reldor scan` | Gera o perfil do projeto (framework, padrões, times) | 1 |
| `reldor index` | Monta ou atualiza o índice da org | 1 |
| `reldor explain "<pergunta>"` | Engenharia reversa: cadeia de automações, fluxo, roteiro de teste | 1 |
| `reldor refine "<ideia da task>"` | Refinador de task | 1 |
| `reldor test-radar` | Testes afetados pelas mudanças atuais | 1 |
| `reldor ask "<pergunta>"` | Perguntas sobre o projeto | 1 |
| `reldor context` | Contexto da mudança para a IA (com nota de risco) | 2 |
| `reldor check` | Queries, limites e padrões | 2 |
| `reldor usages <item>` | Exclusão segura: onde o item é usado | 2 |
| `reldor retrieve` | Retrieve com confirmação da org e snapshot | 2 |
| `reldor deploy` | Deploy com confirmação da org | 2 |
| `reldor xml` | Organiza e remove duplicados nos XMLs alterados | 2 |
| `reldor commit` | Commit limpo | 2 |
| `reldor promote <ambiente>` | Ensaio de promoção e merge inteligente | 2 |
| `reldor collisions` | Radar de colisão com outras branches | 2 |
| `reldor rollback <PR ou commit>` | Plano de rollback | 2 |
| `reldor doc` | Documentação no modelo do cliente | 4 |
