<p align="center"><a href="./tools.md">Português</a> · <strong>English</strong></p>

# tools

## What it does

`tools` says **who takes care of each thing** Reldor can do, so it does not repeat the work of a tool the team already uses. Each thing is a **capability**:

| Capability | What it is | Where Reldor does it | Modes |
|---|---|---|---|
| `xml-duplicates` | XML without duplicated entries | `xml`, `review`, pre-commit hook | run, verify, skip |
| `xml-order` | XML in order | `xml`, `review` | run, verify, skip |
| `org-files` | Files that only came from the org kept out of the commit | `review`, `clean`, pre-commit hook | run, verify, skip |
| `security` | Reldor's security rules | `security`, `review` | run, verify, skip |
| `quality` | Repeated code (Reldor's rules) | `quality`, `review` | run, verify, skip |
| `code-analyzer` | Salesforce Code Analyzer (PMD, CPD, security) | `security`, `quality`, `review` | run, skip |
| `queries` | Field read outside the query | `check`, `test-radar`, `review` | run, verify, skip |
| `affected-tests` | List of tests the change can break | `test-radar`, `review` | run, verify, skip |
| `run-tests` | Running tests in the sandbox | `test-radar --run` | run, skip |
| `pre-commit` | Reldor's pre-commit hook | `hook install` | run, skip |
| `profile-merge` | Item-by-item profile merge | `merge install` | run, skip |

For each one, the project picks a mode, saved in `tools:` in `.reldor/reldor.config.yaml`:

- **`run`** (the default): Reldor does it.
- **`verify`**: another tool does it; Reldor **does not do it again**, it only checks the result. If it is not right, it says which tool to run. Example: the team has a plugin that removes duplicates from profiles. With `xml-duplicates: verify`, `reldor xml` does not rewrite the file, but `review` and the hook still guarantee that no duplicate reaches the commit.
- **`skip`**: another tool takes care of it; Reldor stays out (neither does nor checks it) and says who takes care of it.

It also **looks for signs** of those tools in the project and suggests: Git hooks (`.husky`, `core.hooksPath`, a `pre-commit` that was already there), pipelines (`.github/workflows`, `azure-pipelines.yml` and others), AI instructions kept in the project (`.kiro`, `.claude`, `AGENTS.md`) and `package.json` scripts. It shows the line where it found each sign. **Nothing is saved by itself**: you check and decide.

**Nothing runs twice.** Reldor keeps each check's result by the content of the files it reads. If the hook, `review` and the AI ask for the same check over the same content, only the first one runs; the others reuse it (♻️ shows). Change a file and the check runs again. To redo it anyway, every command takes `--fresh`.

## When to reach for it

Right after `init` (it already shows the signs it found), or when someone says "we already have a tool for that". The AI runs it for you and asks before saving. In the terminal:

```bash
reldor tools                                                   # the list and the suggestions
reldor tools set xml-duplicates verify --owner "team plugin"
reldor tools set code-analyzer skip --owner "pipeline"
reldor tools set xml-order run                                 # "no, Reldor does it": the suggestion won't come back
```

When you ask for a command by name, it follows the mode like this: what **only reads** (`security`, `quality`, `check`, `test-radar`) runs and says who else takes care of it; what **changes something** (`xml` organizing, `clean`, `hook install`, `merge install`, `test-radar --run`) does not act on another tool's capability, unless you add `--force`.

## It's working if

- Reldor never rewrites a file the team's tool also rewrites.
- `review` says what was left out and who takes care of it, instead of hiding it.
- Running `review` twice without changing anything shows ♻️ and answers right away.

## Common questions

**The sign it found does not do the same work.**
Save `run` for that capability (`reldor tools set <capability> run`). That records the decision and the suggestion won't come back.

**Where is the run ledger?**
In `.reldor/cache/runs.json`, outside Git. Deleting it only makes the checks run again.

**What about commits, merges and PRs?**
Reldor never does those: it only builds the Git and org commands, and you or your tool run them.

## Where it fits

After [`init`](./init.en.md). [`status`](./status.en.md) and [`doctor`](./doctor.en.md) warn when there are signs not decided yet, and [`review`](./review.en.md) and the [`commit`](./commit.en.md) hook follow what was decided.
