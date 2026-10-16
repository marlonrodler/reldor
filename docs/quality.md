<p align="center"><strong>English</strong> · <a href="./quality.pt-BR.md">Português</a></p>

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

Only what **your change** touches is reported. Old duplication in files you did not touch, or in parts of a file you did not edit, stays out, so the list fits in one pull request. `--all` reviews the whole project as if it were new, for a one-time cleanup.

Classes that share a contract are left out of "method that already exists": two Selectors with `selectById`, two classes implementing the same interface. That is the pattern, not a copy.

## When to reach for it

The AI runs it before committing Apex, next to [security](./security.md). Say "did I repeat any code?" or run `reldor quality`. Use `--no-analyzer` to skip the Code Analyzer (faster) and `--fail-on média` to return an error in scripts.

## It's working if

- A new class reuses the Service or Selector that already exists instead of copying it.
- Messages move to Custom Labels before they spread.

## Common questions

**Does it replace PMD?**
No, it runs it. Reldor's own checks find what PMD does not: a query that already lives in a Selector, a method that already exists under the same name.

**Can I tune the sizes?**
Yes, in `.reldor/reldor.config.yaml` under `quality`: `min_tokens` (default 60), `min_lines` (6), `min_literal_files` (3).

## Where it fits

Before [commit](./commit.md), with [security](./security.md) and [test-radar](./test-radar.md). It reads the same index as [explain](./explain.md) to know which classes are Selectors.
