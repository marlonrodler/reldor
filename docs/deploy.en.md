<p align="center"><a href="./deploy.md">Português</a> · <strong>English</strong></p>

# deploy

## What it does

`reldor deploy` **builds** the commands to take your files to an org. It **never runs them**: you (or the pipeline) do.

1. Takes the files your branch changed (compared with the base, or the ones in `--files`), only inside the package folders. An LWC or Aura component goes as its folder.
2. Asks the [test radar](./test-radar.en.md) which tests the change can break and uses `RunSpecifiedTests` with them. With no affected tests, it uses `NoTestRun` (or `RunLocalTests` in production).
3. Shows, ready to copy:
   - the **validation**: `sf project deploy start --dry-run --target-org <org> --source-dir ... --test-level ... --wait 60`, which checks and runs the tests without saving anything;
   - the **quick deploy**: `sf project deploy quick --job-id <validation Job ID> --target-org <org>`, which deploys what the validation approved without running the tests again;
   - or the **direct deploy**, without validating first.

**Production:** only the validation. The production deploy goes through the team's pipeline.

**Deleted files** don't go up in a source deploy: Reldor lists them and reminds you that deleting from the org needs a `destructiveChanges.xml` ([`rollback`](./rollback.en.md) shows the format).

**Which org:** the one from `--org`, the environment's (`reldor deploy uat`), the reference org or the `sf` default. If there is none, the command comes out with `<alias-da-org>` in its place, for you to replace.

## When to reach for it

Say "build the deploy to my sandbox" or "how do I take this to UAT?". In the terminal: `reldor deploy --org <alias>`, `reldor deploy <environment>`, `reldor deploy --files force-app/main/default/classes/MyClass.cls`, `reldor deploy --base develop`. With `--json`, it returns the files, the tests and the commands.

Before that, it is worth running [`review`](./review.en.md): security, queries and tests in one summary.

## It's working if

- You no longer build the deploy command by hand, or forget a test.
- The validation deploy passes on the first try more often.

## Common questions

**Why doesn't Reldor run the deploy?**
Because deploying to an org is the developer's (or the pipeline's) call. Reldor checks and builds; you run it and see the result.

**The quick deploy failed with a Job ID error.**
Quick deploy only works with the ID of a validation that passed, and for a limited time. Run the validation again and use the new ID.

**I want to run all local tests.**
Replace `--test-level RunSpecifiedTests --tests ...` with `--test-level RunLocalTests` in the command.

## Where it fits

After [commit](./commit.en.md) and [test-radar](./test-radar.en.md), when you want to see the change in a sandbox. For environments with a pipeline, the path is still the pull request ([promote](./promote.en.md)).
