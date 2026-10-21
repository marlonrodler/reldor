<p align="center"><a href="./task-refine.md">Português</a> · <strong>English</strong></p>

# task-refine

## What it does

`task-refine` writes a Salesforce task from an idea, using only the facts from [refine](../refine.en.md): a one-line summary, what changes (following [automation-design](./automation-design.en.md): the existing handler, a flow, Queueable...), the impact, open questions, acceptance criteria in *given / when / then*, test scenarios (happy path, the block and an existing record) and the size signal. It then asks whether you want to answer the open questions now.

Before calling refine, the AI saves the task text to a file and decides which objects, fields and values it asks for: the result comes without noise, and long text doesn't break the terminal. For each picklist value mentioned, it runs [access](../access.en.md) and puts what has to be enabled (record type, layout, access, path, translation) into "What changes".

## When to reach for it

The AI reaches for it when someone wants to create, write, refine or size a task, story or demand.

## It's working if

- The developer starts without a round of questions.
- The acceptance criteria name the record types and the existing records.

## Where it fits

It is the writer on top of [refine](../refine.en.md). When the spec already exists, it reviews that spec and points out only the gaps (this used to be the spec-review advisor).

The path is light, with no back-and-forth: it finds the task and the spec ([task](../task.en.md)), puts the text in the standard (only if it is not yet), searches only the targets ([refine](../refine.en.md)), shows what already exists to **reuse** or **make generic** instead of creating, what has to be enabled ([access](../access.en.md)) and the limits ([limits](../limits.en.md)), and writes everything at once for you to approve. It saves where you chose: in the spec, in a `.md` in the team's docs, or both.
