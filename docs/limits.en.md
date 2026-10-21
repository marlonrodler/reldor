<p align="center"><a href="./limits.md">Português</a> · <strong>English</strong></p>

# limits

## What it does

`reldor limits` shows what is **close to a Salesforce limit**, counting from the project (no org):

| What | Limit |
|---|---|
| Custom fields per object | 500 (Enterprise and Developer), 800 (Unlimited and Performance), 100 (Professional) |
| Relationship fields (lookup and master-detail) per object | 40 |
| Master-detail per object | 2 |
| Roll-ups per object | 25 |
| Active validation rules per object | 100 (Enterprise and Developer), 500 (Unlimited and Performance), 20 (Professional) |
| Values in a picklist | 1,000 (multi-select: 500; standard ones like Stage and Status: 100) |
| Formula size | 3,900 characters |

With no arguments, it lists only what is at **80% or more**. With an object (`reldor limits Opportunity`), it shows everything for it. The edition comes from `org.edition` in the config (Enterprise when not set).

In **refinement**, when the task asks to create fields, it adds them up: "Opportunity: with the task, custom fields go from 470 to 473 of 500 (95%)". That is where reusing what exists ([refine](./refine.en.md)) helps most.

With `--org <alias>`, it also reads **the org's own limits** (API calls, storage...) with `sf org list limits`. It is read-only, so it runs directly, without asking.

## When to reach for it

Before creating fields or rules on a big object, or to see how the org is doing. The AI uses it during refinement. In the terminal: `reldor limits`, `reldor limits Account,Opportunity`, `reldor limits --all`, `reldor limits --org my-sandbox`.

## It's working if

- Nobody finds out at deploy time that the object takes no more fields.
- The "reuse or create?" talk happens during refinement, with the number on the table.

## Common questions

**The number is lower than in the org.**
It counts what is in the project. What the retrieve did not bring is left out; read it as "at least". Managed package fields have their own allowance and are not counted.

**My org's roll-up limit is higher than 25.**
Salesforce can raise some limits on request to support. Use the number as a warning, not a rule.

## Where it fits

In [refinement](./refine.en.md), next to "does it already exist?", and before creating new metadata.
