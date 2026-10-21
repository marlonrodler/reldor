<p align="center"><a href="./merge.md">Português</a> · <strong>English</strong></p>

# merge

## What it does

`reldor merge <your-branch>` helps merge your development branch into the **merge branch** (the copy of the environment branch you are going to open the PR from), and resolves the conflicts with one rule: **keep what the target already has and apply only your change**.

**Reldor does not run the merge or commit.** With execution off (the default), it checks first (the branch exists, the folder is clean, you are on the merge branch) and shows the commands in order:

```bash
git merge --no-ff --no-commit <your-branch>  # you run it: the merge commit is kept for review
reldor merge --resolve                       # Reldor resolves the conflicts in the files (asks for confirmation)
reldor merge --check                         # checks that only yours went in
reldor merge --continue                      # shows the merge commit for you to run
```

Resolving a conflict is changing a file, so `--resolve` does it after asking for confirmation, and shows the `git add` of the resolved files for you to run. With `execute: on`, `reldor merge <branch>` runs the merge and the staging for you, always asking for confirmation.

1. `git merge --no-ff --no-commit` keeps the merge commit for review.
2. `--resolve` resolves what Git stops on:
   - changes next to each other (yours and someone else's) both go in;
   - you added something where the target also added: the target's stays, yours comes after;
   - you removed something: it leaves the target;
   - profiles, permission sets, labels, sharing rules and translations are joined item by item. When Git "glues" the tags of two blocks (for example the `<field>` of one field inside the block of another), Reldor separates them: the target's block stays whole and yours comes in whole, already sorted as Salesforce does;
   - in any other XML or LWC HTML, it checks that the tags stay well formed. If a line merge would break them, the file is left for review instead of coming out broken.
3. Leaves for review only what both sides changed **on the same lines**, with what the target has and what your branch has. The AI can resolve these with the same rule and explain each one.
4. Checks **"did only yours go in?"**: compares, line by line, what changed in the merge branch with what your branch changed. It points out lines that came in and are not yours, lines of the target that disappeared, yours that are missing, leftover conflict markers and commits by other people going along.

Reldor commits nothing: `reldor merge --continue` checks again and shows `git commit --no-edit`. `reldor merge --check` only checks (also after the commit). `reldor merge --abort` shows `git merge --abort` to undo everything.

## When to reach for it

On the merge branch, say "merge my branch". No more clicking "accept current / incoming / both".

## It's working if

- Merges that used to take a long time resolving conflicts by hand take a quick review.
- The PR has only your change.

## Common questions

**What if the AI resolves a conflict wrongly?**
The check catches it: a line of the target that disappeared, or something that is not yours, shows up before the commit.

**Does execution need to be on?**
No. With execution off you run `git merge` and the commit, and Reldor takes care of the conflicts and the check. If you prefer, commit with your own tool after the check.

**And `reldor merge install`?**
It turns on the item-by-item driver inside the plain `git merge` too (for merges made by other tools), plus `rerere`, after asking for confirmation (it only changes the local Git config). Details in [promote](./promote.en.md#smart-merge).

**The team already has a merge driver for profiles.**
Save `profile-merge: skip` in [`tools`](./tools.en.md): `reldor merge install` then turns nothing on (unless `--force`). The assisted merge (`reldor merge <branch>`) is still available.

## Where it fits

After [promote](./promote.en.md) shows there are no missing dependencies, before the pull request.
