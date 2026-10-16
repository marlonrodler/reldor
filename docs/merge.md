<p align="center"><strong>English</strong> · <a href="./merge.pt-BR.md">Português</a></p>

# merge

## What it does

`reldor merge <your-branch>` does the `git merge` of your development branch into the **merge branch** (the copy of the environment branch you are going to open the PR from), and resolves the conflicts with one rule: **keep what the target already has and apply only your change**.

1. Runs `git merge --no-ff --no-commit`, so the merge commit is kept for review.
2. Resolves by itself what Git stops on:
   - changes next to each other (yours and someone else's) both go in;
   - you added something where the target also added: the target's stays, yours comes after;
   - you removed something: it leaves the target;
   - profiles, permission sets, labels, sharing rules and translations are joined item by item.
3. Leaves for review only what both sides changed **on the same lines**, with what the target has and what your branch has. The AI can resolve these with the same rule and explain each one.
4. Checks **"did only yours go in?"**: compares, line by line, what changed in the merge branch with what your branch changed. It points out lines that came in and are not yours, lines of the target that disappeared, yours that are missing, leftover conflict markers and commits by other people going along.

Nothing is committed until you say so: `reldor merge --continue` checks again and makes the merge commit. `reldor merge --check` only checks (also after the commit). `reldor merge --abort` undoes everything.

## When to reach for it

On the merge branch, say "merge my branch". No more clicking "accept current / incoming / both".

## It's working if

- Merges that used to take a long time resolving conflicts by hand take a quick review.
- The PR has only your change.

## Common questions

**What if the AI resolves a conflict wrongly?**
The check catches it: a line of the target that disappeared, or something that is not yours, shows up before the commit.

**Does it need the Git actions turned on?**
No. It only runs when you ask, and it asks before committing. If you prefer, commit with your own tool after the check.

**And `reldor merge install`?**
It turns on the item-by-item driver inside the plain `git merge` too (for merges made by other tools), plus `rerere`. Details in [promote](./promote.md#smart-merge).

## Where it fits

After [promote](./promote.md) shows there are no missing dependencies, before the pull request.
