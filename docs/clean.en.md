<p align="center"><a href="./clean.md">Português</a> · <strong>English</strong></p>

# clean

## What it does

After a retrieve, the folder mixes your work with what came from the org. `reldor clean` leaves in the folder **only what is yours**, before any tool commits:

- files only the org changed leave the folder;
- in files both changed, only your lines stay;
- your files stay as they are.

What came from the org goes into a Git stash named "reldor clean", so nothing is lost. `reldor clean --undo` brings it back (skipping files you changed after the cleaning). `--dry-run` shows the plan; `--include <file>` keeps a file from the org whole.

It needs the snapshot taken by [`reldor retrieve`](./commit.en.md) (or `reldor snapshot` right after a retrieve made outside Reldor).

## When to reach for it

When you are about to commit: say "I'm going to commit, clean what is not mine". Then commit with your team's workflow tool, another tool or [`reldor commit`](./commit.en.md).

## It's working if

- Commits stop carrying org files and lines nobody wrote.

## Common questions

**Why not only the clean commit?**
Because the commit is often made by another tool that runs `git add -A`. Cleaning the folder makes any tool commit only your work.

**Another tool already removes from the folder what came from the org.**
Save `org-files: skip` (or `verify`) in [`tools`](./tools.en.md): `clean` then leaves the folder alone (`--dry-run` still shows what would go; `--force` cleans anyway).

## Where it fits

Between the retrieve and the commit, next to [commit](./commit.en.md).
