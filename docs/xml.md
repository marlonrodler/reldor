<p align="center"><strong>English</strong> · <a href="./xml.pt-BR.md">Português</a></p>

# xml

## What it does

`xml` organizes metadata XML the way Salesforce retrieves it: entries sorted by their key, and exact duplicates removed. It covers profiles, permission sets, muting permission sets, custom labels, translations, sharing rules, global and standard value sets, object translations and `package.xml`. Picklist values keep their order, because the order is what users see.

It only touches the sections it knows and keeps the exact text of everything else, so the diff shows only what really changed. Two entries with the same key and **different** values (for example the same field, once readable and once editable) are a **conflict**: Reldor leaves both and asks you to decide, because guessing a permission is not safe.

Sorted files also make merges between environments calmer: fewer lines move, so Git finds fewer false conflicts.

## When to reach for it

Before a commit (the AI runs it on the files you changed), or once with `reldor xml --all` to clean a project. `reldor xml --check` only reports; the pre-commit guard uses it.

## It's working if

- Deploys stop failing with "Duplicate value found".
- Diffs of profiles and permission sets show only real changes.

## Common questions

**Does it change layouts or flows?**
No. Their order is meaningful, so they are left alone.

## Where it fits

It runs before [commit](./commit.md) and inside the pre-commit guard.
