<p align="center"><strong>English</strong> · <a href="./index-command.pt-BR.md">Português</a></p>

# index

## What it does

`index` reads the project's metadata and builds a summary of the org: objects, fields, validation rules, record types, triggers, Apex classes (kind, SOQL, DML, fields used, fflib selectors and domains), flows, workflow rules and LWC. It never stores records and never keeps code bodies, only names and links.

It is incremental: the next run reads again only the files whose size or date changed, so it stays fast on large projects.

## When to reach for it

You rarely need it: `explain` and `usages` refresh the index on their own. Run `reldor index` to see the totals, or `reldor index --full` to rebuild from scratch.

## It's working if

- The second run reads almost nothing.
- The totals match your project.

## Common questions

**Where does it live?**
In `.reldor/cache/`, outside Git. Each developer has their own.

**A file could not be read. Is that a problem?**
The rest of the index still works. The message names the file so you can check it.

## Where it fits

It is the engine under every Reldor answer.
