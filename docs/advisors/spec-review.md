<p align="center"><strong>English</strong> · <a href="./spec-review.pt-BR.md">Português</a></p>

# spec-review

## What it does

`spec-review` reads a spec (requirements, design, tasks) before it runs and points out only the gaps that exist: expected volume, what happens to existing records, measurable acceptance criteria, who uses it and with which permissions, error behaviour, record types, and conflicts with automations already on the object. For each gap it explains why it matters and suggests the missing text. If nothing relevant is missing, it stays quiet.

## When to reach for it

The AI reaches for it when a spec is created or changed, or right before the tasks of a spec run (by your spec generator or by the AI itself). You can also ask "review this spec".

## It's working if

- Questions show up in refinement, not in the middle of development.
- It sometimes says nothing, because the spec was already good.

## Where it fits

It works with any spec generator, or with none. Pair it with [automation-design](./automation-design.md) when the spec adds business rules.
