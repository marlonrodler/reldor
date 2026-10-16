<p align="center"><strong>English</strong> · <a href="./test-radar.pt-BR.md">Português</a></p>

# test-radar

## What it does

`test-radar` looks at what your feature changed (commits since production plus what is not committed yet) and lists the Apex tests that can break, each with the reason and a priority. A validation rule, a required field, a record type, a permission, a flow or a trigger on an object points to every test that creates or changes that object, including through test data factories. A changed class points to the tests that use it, and to the tests one step further away.

It also checks the queries of the changed classes: a custom field read from a record that the class queried, but that is not in the SOQL or in the selector. That is the "SObject row was retrieved via SOQL without querying the requested field" error, caught before it reaches UAT.

With `--run`, it runs those tests **without saving anything**: a check-only deploy (`--dry-run`) of your changed files with `RunSpecifiedTests`, so the tests see your local changes. It confirms the org first and refuses production.

## When to reach for it

The AI reaches for it after you change metadata or Apex, and before any deploy. Say "which tests can break?" or run `reldor test-radar`. Then `reldor test-radar --run --org <sandbox>`.

It does not change your pipeline: the pipeline still runs its own tests. The radar only tells you earlier.

## It's working if

- The pipeline stops failing on tests you could have run before.
- When it says a test can break, it usually does.

## Common questions

**What if my local files and the org are different?**
That is why `--run` sends your changed files in a check-only deploy. Use `--org-code` to run the tests against what is already in the org instead.

**Can it miss a test?**
Yes, when a test builds the object name in a string, or when the impact goes through code the index cannot follow. Treat the list as the minimum to run, not the maximum.

**Salesforce has RunRelevantTests. Why not use it?**
It is a good option for the pipeline. The radar explains *why* each test is on the list and runs before you push.

## Where it fits

It sits between development and promotion. It uses the same index as [explain](./explain.md) and [usages](./usages.md).
