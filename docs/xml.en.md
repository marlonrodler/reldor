<p align="center"><a href="./xml.md">Português</a> · <strong>English</strong></p>

# xml

## What it does

`xml` organizes metadata XML the way Salesforce retrieves it: entries sorted by their key, and exact duplicates removed. It covers profiles, permission sets, muting permission sets, custom labels, translations, sharing rules, global and standard value sets, object translations and `package.xml`. Picklist values keep their order, because the order is what users see.

It only touches the sections it knows and keeps the exact text of everything else, so the diff shows only what really changed. Two entries with the same key and **different** values (for example the same field, once readable and once editable) are a **conflict**: Reldor leaves both and asks you to decide, because guessing a permission is not safe.

Sorted files also make merges between environments calmer: fewer lines move, so Git finds fewer false conflicts.

## When to reach for it

Before a commit (the AI runs it on the files you changed), or once with `reldor xml --all` to clean a project. `reldor xml --check` only reports, changing nothing. The pre-commit guard checks duplicates (order does not block a commit).

## It's working if

- Deploys stop failing with "Duplicate value found".
- Diffs of profiles and permission sets show only real changes.

## Common questions

**Does it change layouts or flows?**
No. Their order is meaningful, so they are left alone.

**Another team tool already sorts or removes duplicates.**
Say so in [`tools`](./tools.en.md) (`xml-duplicates` and `xml-order`). With `verify`, `reldor xml` rewrites nothing: it only checks and, if something is missing, says which tool to run; `review` and the hook still guarantee no duplicate reaches the commit. With `skip`, Reldor stays out. To have Reldor organize anyway: `reldor xml --force`. The same file with the same content is checked only once.

## Where it fits

It runs before [commit](./commit.en.md); the duplicate check also runs inside the pre-commit guard.
