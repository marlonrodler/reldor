<p align="center"><strong>English</strong> · <a href="./automation-design.pt-BR.md">Português</a></p>

# automation-design

## What it does

`automation-design` recommends one place for a business rule to live (before-save flow, after-save flow, trigger plus handler, Queueable, Batch, Schedulable or Platform Event) and shows the second-best option. It decides from what **already exists** on the object, using [explain](../explain.md), and from the team's criteria in `.reldor/profile.md`.

It always warns when the object already has a trigger (use its handler, never a second trigger), when a flow and a trigger write the same field, and when there is a risk of recursion or limits. It prefers Queueable over `@future`.

## When to reach for it

The AI reaches for it before creating or changing an automation. You can ask "where should this rule go?".

## It's working if

- No object ends up with two triggers.
- The recommendation names the automations it took into account.

## Where it fits

It sits between [spec-review](./spec-review.md) and the code.
