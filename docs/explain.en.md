<p align="center"><a href="./explain.md">Português</a> · <strong>English</strong></p>

# explain

## What it does

`explain` answers "what happens when a record is saved?" for one object and one event (insert, update or delete). It lists every automation in Salesforce's order of execution: before-save flows, before triggers, validation rules, after triggers, legacy workflow rules and processes, after-save flows, the roll-up cascade to parent records, and what runs asynchronously after the commit.

The chain is built by scripts from the index, not guessed by the AI. Triggers are followed into their classes, through the fflib `Application` factory, up to two levels deep. An fflib domain that does not override the handler for a phase (for example `onAfterUpdate`) is shown as idle, so you don't chase logic that never runs.

## When to reach for it

Ask your AI "what happens when an Opportunity is closed?", or run `reldor explain Opportunity --event update`. Reach for it before you touch an object you don't know well, when writing a task, when documenting a process, when building a test script, or when a bug in UAT makes no sense.

For "where is this field or class used?", use [usages](./usages.en.md) instead.

## It's working if

- Nothing in UAT surprises you that `explain` didn't list.
- Conditional flows show their entry criteria, so you know when they run.
- You spot a bypass switch (custom setting or custom metadata) before you test.
- The related test classes it lists are the ones that break when you change the object.

## Common questions

**Does it see everything in the org?**
No. It reads the repository. Managed packages and anything created directly in the org without being retrieved do not appear. The output says so every time.

**Why is the order "simplified"?**
Salesforce's full order has more steps (assignment rules, escalation, entitlement, sharing). `explain` shows the ones that come from your code and metadata.

**Which trigger frameworks does it understand?**
fflib domains (`onBeforeUpdate`, `onValidate`, `onApplyDefaults`...), TriggerHandler-style classes (`beforeUpdate`, `afterInsert`...) and metadata-driven triggers, where handlers are listed in custom metadata records. For each phase it follows only the methods that run in that phase, including the private helpers they call.

**Can it write a test script?**
Yes. Ask the AI for one: it turns each step into action → what fires → what to check.

## Where it fits

`explain` is the heart of Phase 1. The same index feeds [usages](./usages.en.md), the advisors and, next, the test radar and task refinement.
