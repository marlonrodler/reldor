<p align="center"><a href="./task.md">Português</a> · <strong>English</strong></p>

# task

## What it does

`reldor task` finds out **which task you are on**, without you saying it:

- **The id from the branch**: `feature/1234`, `feature/team-1234-fix`, `bugfix/ABC-123-description`, `1234-fix`... Dates and versions (`release/2024-10`, `hotfix/1.2.3`) do not count as task ids.
- **The task's spec in any tool**: Kiro (`.kiro/specs`), Spec Kit (`specs`, `.specify/specs`), OpenSpec (`openspec`), `docs/specs` or any folder with `requirements.md`, `design.md`, `tasks.md` or `spec.md` whose name has the id. If it finds one in two tools, it asks which one counts.
- **The phase**: no changed code and no spec, refine; with a spec, develop; with changed code, develop and review; with commits ready, promote.
- **A folder per task** (`.reldor/work/tasks/<id>/`, out of Git): the refinement and the searches stay there. Back on the task, it resumes without searching again.
- **Switching tasks**: you changed branch (or said "now it's 5678"), `status` says it once, "task changed: 1234 → 5678", and the AI stops using what belonged to the previous one.

None of this is fixed to one company. The branch shape is **learned** from the repository (it shows the shapes it found, like `feature/<time>-<id>-<descrição>`) and confirmed once. The same goes for where specs live and for the team's **documentation folder**: it looks for folders with Markdown (for example, a folder with one subfolder per team) and suggests them.

It works even when **another tool started the task** without knowing about Reldor (created the branch and the spec): it finds everything when it comes in.

## When to reach for it

The AI uses it by itself at the start of the work (`reldor status` already brings the task). In the terminal:

- `reldor task`: the task, the spec, the phase and what it found in the project;
- `reldor task use 1234` / `reldor task clear`: say which task it is when it is not in the branch;
- `reldor task set --branch-shape "feature/<time>-<id>-<descrição>"`, `--spec-dir <folder>`, `--docs-dir "<folder>/{time}"`: the project's patterns (they go into the config, for the whole team);
- `reldor task output spec | md | ambos`: where the refined task goes, for you (only on your machine).

## It's working if

- The AI starts knowing the task and the spec, without asking.
- Two tasks in the same chat do not get mixed.

## Common questions

**My company uses another branch format.**
It learns what exists in the repository. If it gets it wrong, save the shape with `--branch-shape` or a regular expression with `--branch-pattern`.

**The spec is in a tool it does not know.**
If the folder has spec files with the task id in its name, it finds it. Otherwise, say where with `reldor task set --spec-dir <folder>`.

## Where it fits

At the very start: the right task decides what to [refine](./refine.en.md), which spec to follow and where to save the result.
