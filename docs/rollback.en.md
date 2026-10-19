<p align="center"><a href="./rollback.md">Português</a> · <strong>English</strong></p>

# rollback

## What it does

`rollback <PR number | commit | branch>` builds the full plan to undo a change, **without changing anything**:

- the commits to undo and the environments where they are;
- what **goes back** to its old version (the `git revert` handles it);
- what the PR **created** and has to be deleted from the org, with a ready `destructiveChanges.xml` and an empty `package.xml` in `.reldor/work/rollback-<id>/`;
- the **risks**: an item to delete that something else started using after the PR (the deploy would fail), files that changed again after the PR (the revert may conflict or undo someone else's work), and what deleting each type means (a field takes its data with it, a flow must be deactivated first, a record type in use cannot be deleted).

The steps follow the team's flow: a `rollback/...` branch from production, a `git revert` of **the feature's commits** (not of the merge), so the rollback goes through the pipeline in order, like any feature, with [promote](./promote.en.md) at each environment.

The PR number is found in the merge commit messages ("Merge pull request #123", "Merged PR 123").

## When to reach for it

Say "I need to roll back PR 123". The AI shows the plan and the risks, and only runs a step after you confirm.

## It's working if

- A rollback does not break the deploy because of a field someone started using.
- Nobody discovers in production that a destructive change was missing.

## Common questions

**Does it run the deploy?**
No. It gives you the command for a validation without saving (`--dry-run`). Deploying stays with the pipeline.

**And record data?**
Data loaded or changed by the feature does not come back with a metadata rollback. The plan reminds you.

## Where it fits

After a problem in an environment. Then [promote](./promote.en.md) takes the rollback branch through the environments.
