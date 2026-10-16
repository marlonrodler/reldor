<p align="center"><strong>English</strong> · <a href="./collisions.pt-BR.md">Português</a></p>

# collisions

## What it does

`collisions` looks at the other open branches (local and `origin/`) with commits in the last 30 days and lists the ones that change the same files as yours, with the risk:

| Risk | When |
|---|---|
| 🔴 High | The same lines were changed in both branches: a conflict is almost certain |
| 🟡 Medium | Same file, different parts |
| ⚪ Low | Profiles, permission sets, labels and similar: the [smart merge](./promote.md#smart-merge) joins them item by item |

For each branch it shows the author, the date of the last commit and the environments it already reached. Environment branches, your own branch and branches already in production are skipped.

## When to reach for it

When you start a task on a shared class, and before promoting. Say "is anyone else changing these files?". `--fetch` updates the remote branches first; `--days 60` looks further back.

## It's working if

- You hear about the other branch before the conflict, not during the merge.

## Common questions

**Does it read branches from the server?**
Only what Git already has locally. Use `--fetch` to update.

## Where it fits

Next to [promote](./promote.md): collisions warns early, the rehearsal shows the real conflict.
