<p align="center"><a href="./commit.md">Português</a> · <strong>English</strong></p>

# commit

## What it does

`commit` prepares a **clean commit**: only what you changed, never what a retrieve brought from the org. It works with a **snapshot** taken right after the retrieve. Everything in the folder at that moment counts as "from the org"; only what you change afterwards counts as yours.

It works **line by line**. If the retrieve changed a class and you changed other lines of the same class, only your lines go in; the org's lines stay in the folder, out of the commit. If your lines touch the org's lines, that file stays out and Reldor tells you, so you decide.

**Reldor does not commit.** With execution off (the default), `reldor commit` writes your lines into a patch (`.reldor/work/commit/so-o-seu.patch`, already checked against your repository) and shows three commands for you to run:

```bash
git restore --staged .                                                      # start with an empty stage
git apply --cached --3way --whitespace=nowarn .reldor/work/commit/so-o-seu.patch   # only your lines staged
git commit -m "message"                                                     # or commit with your own tool
```

Don't run `git add -A` before the commit: it would put everything back together.

`retrieve` runs nothing in the org either: it picks the org (the one from `--org`, the environment's or the reference org), warns when you have uncommitted work the retrieve could overwrite, and shows the ready `sf project retrieve start`, followed by `reldor snapshot` to take the snapshot. A retrieve of **specific** metadata (`--metadata`) counts as yours, because you asked for it, and needs no snapshot.

`hook install` adds a pre-commit guard to `.git/hooks`, after asking for your confirmation. It runs on **every** commit, including the ones you make by hand, and blocks two things: duplicated entries in profiles, permission sets and other XML, and files that only came from the org.

With `execute: on` in the config, `reldor commit -m "..."` and `retrieve` run the commands, always asking for confirmation.

## When to reach for it

Say "I want to commit" and the AI runs it for you: first `--dry-run` to show "yours / only your lines / from the org", then `reldor commit`, and it gives you the commands. In the terminal: `reldor retrieve`, run what it shows, develop, then `reldor commit -m "message"`. Install the guard once per project with `reldor hook install`.

## It's working if

- Pull requests stop carrying metadata nobody on the task touched.
- You never again lose an afternoon pulling a retrieve out of a commit.

## Common questions

**I ran the retrieve straight from the sf CLI.**
Run `reldor snapshot` right after. Everything in the folder at that moment counts as from the org.

**I need a whole file that came from the org.**
`reldor commit -m "..." --include path/to/file`.

**The guard blocked something I really want to commit.**
Fix what it points out, or use `git commit --no-verify` when it is intentional.

**What happens to the org changes after the commit?**
They stay in your folder, out of Git. Discard them with `git restore <file>` if you don't need them.

**The team already has a commit hook (husky, core.hooksPath).**
`hook install` keeps an existing `pre-commit` and runs it first. With `core.hooksPath`, it doesn't touch the team's hooks and shows the line to add. If the team's hook already does the same job, save `pre-commit: skip` (or `xml-duplicates: verify`) in [`tools`](./tools.en.md).

## Where it fits

Between development and promotion: retrieve → develop → [test-radar](./test-radar.en.md) → [xml](./xml.en.md) → commit → [deploy](./deploy.en.md) to the sandbox, when needed.
