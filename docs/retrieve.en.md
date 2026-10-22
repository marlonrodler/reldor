<p align="center"><a href="./retrieve.md">Português</a> · <strong>English</strong></p>

# retrieve

## What it does

Builds the retrieve command for the right org. Reldor **does not run** the retrieve: it shows the command, you run it.

**Before changing a file** (`reldor retrieve --files <files>`): a file that already exists first comes from the reference
org (the `reference_org` of `reldor env`; without it, the project's default org), so the change starts from what is really
there, not from an old copy in the branch.

- It builds `sf project retrieve start --metadata ...` for those files only.
- It leaves out, saying why: a file with an uncommitted change of yours (the retrieve would erase it), a profile alone
  (it comes only in part from the org and would erase the rest of the file) and what is not metadata.
- It writes down how each file looked. After you run it, **`reldor retrieve --check`** confirms the retrieve really
  rewrote each one. Only then does the AI change them.
- `review` warns (`[retrieve]`) when a file that already existed was changed without that retrieve first.
- **`reldor retrieve --compare --files <files>`** brings the org version into `.reldor/work/org-copy`, without touching
  your files, to compare what was already changed.

**The whole project** (`reldor retrieve`, no files): builds the retrieve and, after it, `reldor snapshot`, the snapshot
that keeps what came from the org out of your commit (see [`commit`](./commit.en.md)).

## When to reach for it

The AI uses it on its own before changing an existing file: you only run the command it shows and say "done". New files
don't need it. If your team brings files from the org some other way, turn it off with
`reldor tools set retrieve-first skip`.

## It's working if

- The AI doesn't change an existing class, flow or LWC without first handing you its retrieve.
- `reldor retrieve --check` says "Vieram da org" for the files you brought.
- `review` shows no `[retrieve]`.

## Common questions

**I ran the retrieve, but `--check` says the file is still the same.**
The retrieve did not run, failed, or used another org. Run it again and check the `sf` output.

**Why is the profile left out?**
A profile retrieved alone comes with only part of its permissions and would overwrite the branch's whole file.

## Where it fits

During development, before each existing file the task changes. What comes from the org counts as yours in the commit,
because you asked for those files.
