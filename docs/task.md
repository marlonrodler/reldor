<p align="center"><strong>Português</strong> · <a href="./task.en.md">English</a></p>

# task

## O que faz

O `reldor task` descobre **em que tarefa você está**, sem você precisar dizer:

- **O número pela branch**: `feature/1234`, `feature/time-1234-ajuste`, `bugfix/ABC-123-descricao`, `1234-ajuste`... Datas e versões (`release/2024-10`, `hotfix/1.2.3`) não contam como número de tarefa.
- **A spec da tarefa em qualquer ferramenta**: Kiro (`.kiro/specs`), Spec Kit (`specs`, `.specify/specs`), OpenSpec (`openspec`), `docs/specs` ou qualquer pasta com `requirements.md`, `design.md`, `tasks.md` ou `spec.md` cujo nome tenha o número. Se achar em duas ferramentas, pergunta qual vale.
- **A fase**: sem código mudado e sem spec, refinar; com spec, desenvolver; com código mudado, desenvolver e revisar; com commits prontos, promover.
- **Uma pasta por tarefa** (`.reldor/work/tasks/<número>/`, fora do Git): o refinamento e as buscas ficam lá. Voltou para a tarefa, retoma sem buscar de novo.
- **Troca de tarefa**: mudou de branch (ou disse "agora é a 5678"), o `status` avisa uma vez, "mudou de tarefa: 1234 → 5678", e a IA para de usar o que era da anterior.

Nada disso é fixo numa empresa. O formato das branches é **aprendido** do repositório (ele mostra os formatos que encontrou, como `feature/<time>-<id>-<descrição>`) e confirmado uma vez. O mesmo vale para o lugar das specs e para a **pasta de documentação** do time: ele procura pastas com Markdown (por exemplo, uma pasta com uma subpasta por time) e sugere.

Funciona mesmo quando **outra ferramenta começou a tarefa** sem saber do Reldor (criou a branch e a spec): ele encontra tudo quando entra.

## Quando usar

A IA usa sozinha no começo do trabalho (`reldor status` já traz a tarefa). No terminal:

- `reldor task`: a tarefa, a spec, a fase e o que ele encontrou no projeto;
- `reldor task use 1234` / `reldor task clear`: dizer qual é a tarefa quando ela não está na branch;
- `reldor task set --branch-shape "feature/<time>-<id>-<descrição>"`, `--spec-dir <pasta>`, `--docs-dir "<pasta>/{time}"`: os padrões do projeto (vão para a configuração, valem para o time);
- `reldor task output spec | md | ambos`: para onde vai a task refinada, para você (fica só na sua máquina).

## Está funcionando se

- A IA começa sabendo a tarefa e a spec, sem perguntar.
- Duas tarefas no mesmo chat não se misturam.

## Perguntas comuns

**A minha empresa usa outro formato de branch.**
Ele aprende o que existe no repositório. Se não acertar, grave o formato com `--branch-shape` ou uma expressão regular com `--branch-pattern`.

**A spec está numa ferramenta que ele não conhece.**
Se a pasta tiver arquivos de spec com o número da tarefa no nome, ele acha. Senão, diga onde com `reldor task set --spec-dir <pasta>`.

## Onde se encaixa

No começo de tudo: a tarefa certa decide o que [refinar](./refine.md), qual spec seguir e onde guardar o resultado.
