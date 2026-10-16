<p align="center"><strong>English</strong> · <a href="./status.pt-BR.md">Português</a></p>

# status

## What it does

`status` tells you where you are and what to do next: current branch, files not committed yet, the Salesforce project facts, the spec linked to the branch, and **which environments already have your feature** (for example ✅ develop · ⬜ uat · ⬜ production). It ends with one suggested next step.

It compares your branch's own commits (the ones not in production yet) with each environment branch, preferring the remote branch (`origin/...`).

## When to reach for it

It is the first thing the AI runs when you say "I want to use Reldor". In the terminal: `reldor status`, `reldor status --fetch` to refresh the remote branches first, or `--json` for scripts.

## It's working if

- You stop asking "did this go to UAT already?".
- The suggested next step matches what you would have done.

## Common questions

**It says a commit is missing in UAT, but I merged it.**
Run with `--fetch`: your local copy of `origin/...` may be old.

## Where it fits

`status` is the router's eyes. The `reldor` skill reads it to decide which step to lead you to.
