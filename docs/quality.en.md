<p align="center"><a href="./quality.md">Português</a> · <strong>English</strong></p>

# quality

## What it does

`quality` reviews the Apex classes your feature changed and reports **the repetition your change creates**, plus the code quality rules of the official **Salesforce Code Analyzer** when it is installed (`sf plugins install code-analyzer`).

| Finding | What it means |
|---|---|
| Copied block | Lines you added are the same as lines somewhere else in the project (literals and messages ignored, like PMD's CPD) |
| Repeated query | The same SOQL already exists in another class (binds, literals and spacing ignored) |
| Query outside the Selector | In an fflib project, a query on an object that has a Selector, written outside it |
| Method that already exists | Same name, same parameters and a similar body in another class |
| Similar method | A different name, but 80% or more of the body is the same |
| Repeated text | The same message in three or more classes: a Custom Label candidate |
| Code Analyzer | PMD `Recommended` rules (complexity, naming, best practices, performance) and CPD |

Only what **your change** touches is reported. Old duplication in files you did not touch, or in parts of a file you did not edit, stays out, so the list fits in one pull request. `--all` reviews the whole project as if it were new, for a one-time cleanup. Each repetition is reported once: one finding per repeated text, per repeated query, per pair of similar methods and per pair of files with copied blocks (a generated class with hundreds of equal blocks is one line).

Classes that share a contract are left out of "method that already exists": two Selectors with `selectById`, two classes implementing the same interface. That is the pattern, not a copy.

## When to reach for it

The AI runs it before committing Apex, next to [security](./security.en.md). Say "did I repeat any code?" or run `reldor quality`. Use `--no-analyzer` to skip the Code Analyzer (faster) and `--fail-on média` to return an error in scripts.

## It's working if

- A new class reuses the Service or Selector that already exists instead of copying it.
- Messages move to Custom Labels before they spread.

## Common questions

**Does it replace PMD?**
No, it runs it. Reldor's own checks find what PMD does not: a query that already lives in a Selector, a method that already exists under the same name.

**Can I tune the sizes?**
Yes, in `.reldor/reldor.config.yaml` under `quality`: `min_tokens` (default 60), `min_lines` (6), `min_literal_files` (3).

**The pipeline already runs PMD and CPD.**
Save `code-analyzer: skip` in [`tools`](./tools.en.md): `quality` runs only Reldor's rules (`--analyzer` runs the Code Analyzer anyway). With the same content, the same analysis does not run twice.

## Where it fits

Before [commit](./commit.en.md), with [security](./security.en.md) and [test-radar](./test-radar.en.md). It reads the same index as [explain](./explain.en.md) to know which classes are Selectors.
