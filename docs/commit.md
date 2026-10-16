<p align="center"><strong>English</strong> · <a href="./commit.pt-BR.md">Português</a></p>

# commit

## What it does

`commit` makes a **clean commit**: only what you changed, never what a retrieve brought from the org. It works with a **snapshot** taken right after the retrieve. Everything in the folder at that moment counts as "from the org"; only what you change afterwards counts as yours.

It works **line by line**. If the retrieve changed a class and you changed other lines of the same class, only your lines go into the commit; the org's lines stay in the folder, uncommitted. If your lines touch the org's lines, that file stays out and Reldor tells you, so you decide.

`retrieve` takes the snapshot for you: it confirms the org, warns when you have uncommitted work that the retrieve could overwrite, and runs `sf project retrieve start`. A retrieve of **specific** metadata (`--metadata`) counts as yours, because you asked for it.

`hook install` adds a pre-commit guard to `.git/hooks`. It runs on **every** commit, including the ones you make by hand, and blocks two things: duplicated entries in profiles, permission sets and other XML, and files that only came from the org.

**When Git actions are off** (the default, when another tool commits for you), `reldor commit` only shows the plan. `reldor commit --stage` leaves only your lines in the stage, without committing, for your tool to commit. A `git add -A` by that tool joins everything again.

## When to reach for it

Say "I want to commit" and the AI runs it for you: first `--dry-run` to show you "yours / only your lines / from the org", then the commit. In the terminal: `reldor retrieve`, then `reldor commit -m "message"`. Install the guard once per project with `reldor hook install`.

## It's working if

- Pull requests stop carrying metadata nobody on the task touched.
- You never again lose an afternoon cleaning a retrieve out of a commit.

## Common questions

**I retrieved with the sf CLI directly.**
Run `reldor snapshot` right after. Everything in the folder at that moment counts as from the org.

**I need a whole file that came from the org.**
`reldor commit -m "..." --include path/to/file`.

**The hook blocked something I really want to commit.**
Fix what it says, or commit with `git commit --no-verify` when it is intentional.

**What happens to the org's changes after the commit?**
They stay in your folder, outside Git. Discard them with `git restore <file>` if you don't need them.

## Where it fits

It sits between development and promotion: retrieve → develop → [test-radar](./test-radar.md) → [xml](./xml.md) → commit.
