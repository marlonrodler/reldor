<p align="center"><a href="./collisions.md">Português</a> · <strong>English</strong></p>

# collisions

## What it does

`collisions` looks at your colleagues' work **that is moving forward** and lists what changes the same files as your branch. Moving forward means:

- an **open pull request** on GitHub (read with `gh`, with your login). For a merge branch, only what the PR adds to the environment counts;
- a branch that **already reached an environment** (pre-UAT, UAT).

Branches without a PR and outside the environments are ignored, since they may be stalled or abandoned. `--all` shows them all. For each item, the risk:

| Risk | When |
|---|---|
| 🔴 High | The same lines were changed in both branches: a conflict is almost certain |
| 🟡 Medium | Same file, different parts |
| ⚪ Low | Profiles, permission sets, labels and similar: the [smart merge](./promote.en.md#smart-merge) joins them item by item |

For each branch it shows the author, the date of the last commit and the environments it already reached. Environment branches, your own branch and branches already in production are skipped.

## When to reach for it

When you start a task on a shared class, and before promoting. Say "is anyone else changing these files?". `--fetch` updates the remote branches first; `--days 60` looks further back.

## It's working if

- You hear about the other branch before the conflict, not during the merge.

## Common questions

**Does it read branches from the server?**
Branches: only what Git already has locally (use `--fetch` to update). Pull requests come from GitHub through `gh`; without `gh` installed and logged in, it checks only the branches already in environments.

## Where it fits

Next to [promote](./promote.en.md): collisions warns early, the rehearsal shows the real conflict.
