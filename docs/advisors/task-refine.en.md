<p align="center"><a href="./task-refine.md">Português</a> · <strong>English</strong></p>

# task-refine

## What it does

`task-refine` writes a Salesforce task from an idea, using only the facts from [refine](../refine.en.md): a one-line summary, what changes (following [automation-design](./automation-design.en.md): the existing handler, a flow, Queueable...), the impact, open questions, acceptance criteria in *given / when / then*, test scenarios (happy path, the block and an existing record) and the size signal. It then asks whether you want to answer the open questions now.

## When to reach for it

The AI reaches for it when someone wants to create, write, refine or size a task, story or demand.

## It's working if

- The developer starts without a round of questions.
- The acceptance criteria name the record types and the existing records.

## Where it fits

It is the writer on top of [refine](../refine.en.md). Pair it with [spec-review](./spec-review.en.md) once the spec exists.
