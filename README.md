<p align="center"><strong>English</strong> · <a href="./README.pt-BR.md">Português</a></p>

# 🛡️ Reldor: the guardian of Salesforce development

The guardian that reads your org before your AI writes a line of code.

AI already writes Salesforce code fast. What it does not do is see the whole org: the flow that runs before your trigger, the validation rule that will break other teams' tests, the roll-up that saves the parent record too. And Git does not understand Salesforce metadata, so profiles conflict for no reason and commits carry whatever the last retrieve brought down.

Reldor fixes this with one rule: **scripts do the heavy, reliable work; the AI only explains and guides.** It builds an index of your project, follows the real order of execution, and talks to you through the AI you already use (Kiro or Claude Code). You don't memorize commands: you say what you want.

> **Status:** Phase 1 is done; Phase 2 in progress: security and quality review, smart merge, promotion rehearsal, clean commit, XML organizer and pre-commit guard work today. See the [roadmap](./docs/roadmap.md).

## Installation (5-minute setup)

Two things, done **once** on your computer: the `reldor` command and the plugin in your AI. After that, in each project, you just talk.

```text
Your computer
├─ reldor command ............ step 2: installed by npm, works in any folder
├─ plugin in your AI ......... step 3: Kiro or Claude Code
└─ C:\...\salesforce-project . the team's project (has sfdx-project.json)
   └─ .reldor\ ............... step 5: created here, with the project's settings
```

Reldor **does not live inside the project**: nothing of it goes into the team's repository, except the `.reldor/` folder.

### 1. What you need first

Open a terminal (on Windows, **PowerShell**; the VS Code terminal works too) and check:

```bash
node --version   # Node.js 18 or newer
git --version    # Git
sf --version     # Salesforce CLI (sf v2)
```

Install what is missing, then **close and open the terminal** so the new commands are found:

| Tool | Windows (PowerShell) | Mac | Other ways |
|---|---|---|---|
| **Node.js** (LTS, 18+) | `winget install OpenJS.NodeJS.LTS` | `brew install node` | [nodejs.org](https://nodejs.org) |
| **Git** | `winget install Git.Git` | `brew install git` | [git-scm.com](https://git-scm.com/downloads) |
| **Salesforce CLI** | `npm install --global @salesforce/cli` | `npm install --global @salesforce/cli` | [installer](https://developer.salesforce.com/tools/salesforcecli) |

> The Salesforce CLI installer brings its own Node.js, but it does not put `node` on your PATH. Reldor needs Node.js installed on its own.

Optional: the **Salesforce Code Analyzer** adds the official rules (PMD, CPD, security) to `review` (`sf plugins install code-analyzer`, needs Java 11+), and the **GitHub CLI** lets Reldor read open pull requests (`winget install GitHub.cli`, then `gh auth login`).

### 2. Install the `reldor` command

In the same terminal, **in any folder**:

```bash
npm install -g github:marlonrodler/reldor
reldor --version
```

If the version number shows, it worked. You don't pick a folder: npm keeps Reldor with your other global commands, outside your projects.

- **Update:** run the same `npm install -g github:marlonrodler/reldor`.
- **Uninstall:** `npm uninstall -g reldor`.

### 3. Add Reldor to your AI

**Kiro**
1. Open the **Powers** panel (icon on the left bar) and click **Add Custom Power**.
2. Choose **Import power from GitHub** and paste this link:
   `https://github.com/marlonrodler/reldor/tree/main/plugins/kiro/reldor`
3. Click **Install**.

When a new version comes out, import it again from the same link.

**Claude Code**, in a terminal:

```bash
claude plugin marketplace add marlonrodler/reldor
claude plugin install reldor@reldor
```

**No AI:** everything works as a terminal command. `reldor help` lists them.

### 4. Check, from inside the project

1. In VS Code, **File → Open Folder** and pick the Salesforce project folder (the one with `sfdx-project.json`).
2. **Terminal → New Terminal**. The terminal opens in the project folder.
3. Run:

```bash
reldor doctor
```

It checks what is installed, whether the terminal is in the right folder and whether the plugin is in your AI, and ends with **one** next step. If something is missing, it gives the command that fixes it. See [`doctor`](./docs/doctor.md).

### 5. Say hello to your AI, in that project

With the project open, open your AI's chat and say:

> I want to use Reldor

From here on **you don't run commands**: the AI runs them for you and explains the result. It detects the project, asks only what it cannot detect (environment branches, reference org, design system, whether you already have a tool that commits and opens PRs) and tells you the next step. This creates a `.reldor/` folder **in that project**, with its settings: commit it, it is for the whole team. Do it once per project. The environment chain (names, branches, order, which one is production) is yours to set and change later with [`reldor env`](./docs/env.md).

<details>
<summary><b>Something went wrong?</b></summary>

- **"reldor is not recognized as a command"**: close and open the terminal (or all of VS Code). If it persists, run `npm prefix -g` and check that this folder is on your PATH.
- **"running scripts is disabled on this system"** (PowerShell): use `reldor.cmd doctor` instead of `reldor doctor`, or run it in Command Prompt (cmd). Changing PowerShell's execution policy is your IT team's call.
- **`doctor` says it is Reldor's own folder, or that it found no project**: the terminal is in the wrong folder. Open the project folder in VS Code and open a new terminal.
- **The AI says it doesn't know Reldor**: the plugin isn't installed (step 3), or the chat was opened before installing. Open a new chat.

</details>

## Why Reldor exists

### #1: The AI doesn't see the whole org

**The problem.** The AI reads the files you point it at. It does not know that a before-save flow already sets that field, that a workflow rule fires your update triggers a second time, or that saving a child record recalculates and saves its parent. You find out in UAT.

**The fix.** An index built by scripts, not guessed by the AI:

- [`explain`](./docs/explain.md): what happens when a record is saved, in the real order of execution, following the fflib chain through your `Application` class.
- [`usages`](./docs/usages.md): every place a field, class, method, flow or object is used, with how sure it is.
- [`refine`](./docs/refine.md): before the task is even written, what it touches and what to ask.

### #2: Tests break by surprise

**The problem.** A new validation rule, a required field or a permission breaks tests from other teams. Nobody notices until the pipeline fails, hours later.

**The fix.** [`test-radar`](./docs/test-radar.md) points to the tests your change can break, says why, and runs them in a sandbox without saving anything. It also checks that every field your code reads is in the query.

### #3: Git doesn't understand Salesforce

**The problem.** Two people add different classes to the same profile and Git offers "all or nothing". A retrieve mixes the org into your work. A promotion fails because a field only exists in develop.

**The fix.** [`clean`](./docs/clean.md) leaves only your work in the folder before any tool commits. An [assisted merge](./docs/merge.md) does the `git merge` into the merge branch and resolves the conflicts by keeping the target and applying only your change, then checks that **only yours went in**. A [promotion rehearsal](./docs/promote.md) finds out-of-order commits and fields that only exist in develop before the pull request. Plus an [XML organizer](./docs/xml.md), a pre-commit guard and a [rollback plan](./docs/rollback.md) with the revert, the `destructiveChanges.xml` and the risks.

### #4: Security holes and copied code nobody saw

**The problem.** A screen method that reads data without checking permissions, a query built by concatenating what the user typed, a `System.debug` with a CPF, a class that ignores sharing three calls away from the screen. In a bank, any of these is an incident.

**The fix.** [`security`](./docs/security.md) reviews your changes before the commit: Reldor's own rules plus the official Salesforce Code Analyzer when installed. It also follows the **path**: from a screen or API down to a `without sharing` class that touches data, something a file-by-file scanner does not see.

[`quality`](./docs/quality.md) catches the copy before it spreads: a block pasted from another class, a query that already lives in a Selector, a method that already exists. Only the repetition your change creates, plus PMD and CPD from the Code Analyzer.

### #5: Screens and automations on autopilot

**The problem.** The AI jumps straight into code: one more trigger on an object that already has one, `@future` where Queueable fits, a screen built from raw HTML.

**The fix.** Advisors that step in **before** the code, with one question and no blocking:

- [spec-review](./docs/advisors/spec-review.md): finds the gaps in the spec.
- [automation-design](./docs/advisors/automation-design.md): where the logic should live (flow, trigger, Queueable, Batch), given what already exists.
- [lwc-ux](./docs/advisors/lwc-ux.md): two or three modern screen options with SLDS, plus a throwaway POC.

## Reference

✅ available · 🚧 planned

### The moments

You don't memorize commands: you say what you want and the AI runs the right one. These are the moments it covers.

| Moment | What you say | What Reldor does |
|---|---|---|
| **What now?** | "what now?" | [`status`](./docs/status.md): where you are, warnings if you went up now, next step |
| **Understand** | "what happens when an Opportunity is closed?", "where is this used?", "help me write this task" | [`explain`](./docs/explain.md), [`usages`](./docs/usages.md), [`refine`](./docs/refine.md) and the advisors |
| **Review** | "can I commit?" | [`review`](./docs/review.md): security, quality and repeated code, fields outside the query, tests that can break and XML, in one summary |
| **Clean** | "I'm going to commit, clean what is not mine" | [`clean`](./docs/clean.md): leaves only your work in the folder; then you commit with your tool |
| **Merge** | "merge my branch" (on the merge branch) | [`merge`](./docs/merge.md): resolves the conflicts keeping the target and applying only your change, then checks that only yours went in |
| **Go up** | "is it ready for pre-UAT?" | [`promote`](./docs/promote.md): commit order and missing dependencies before the PR |
| **Undo** | "I need to roll back PR 123" | [`rollback`](./docs/rollback.md): revert, `destructiveChanges.xml` and risks |

A pre-commit guard also runs by itself on every commit, even the ones made by other tools.

<details>
<summary><b>All commands</b> (the pieces behind the moments)</summary>

| Command | What it does | |
|---|---|---|
| [`reldor env`](./docs/env.md) | The environment chain and branch names: show and change, nothing fixed in the code | ✅ |
| [`reldor review`](./docs/review.md) | Review before the commit: security, quality, queries, tests and XML at once | ✅ |
| [`reldor doctor`](./docs/doctor.md) | Checks the installation and the terminal's folder, and gives the next step | ✅ |
| [`reldor init`](./docs/init.md) | Sets Reldor up in a project, asking only what it can't detect | ✅ |
| [`reldor status`](./docs/status.md) | Where you are: branch, pending files, environments, spec, next step | ✅ |
| [`reldor index`](./docs/index-command.md) | Builds the project index; reads again only what changed | ✅ |
| [`reldor explain`](./docs/explain.md) | Reverse engineering: automations in the order of execution | ✅ |
| [`reldor usages`](./docs/usages.md) | Where something is used, before you change or delete it | ✅ |
| `reldor log` | Everything Reldor did, newest first | ✅ |
| [`reldor refine`](./docs/refine.md) | The facts behind a task idea: impact, attention points, open questions, size | ✅ |
| [`reldor test-radar`](./docs/test-radar.md) | Tests that can break with your changes, and runs them without saving | ✅ |
| [`reldor check`](./docs/check.md) | Fields read outside the query (SOQL or selector) | ✅ |
| [`reldor security`](./docs/security.md) | Security review of your changes: SOQL injection, CRUD/FLS, sharing, sensitive logs, secrets, XSS, flows, guest access | ✅ |
| [`reldor retrieve`](./docs/commit.md) | Retrieve with org confirmation; takes the snapshot for the clean commit | ✅ |
| [`reldor clean`](./docs/clean.md) | Before committing: leaves only your work in the folder; the org part goes to a stash | ✅ |
| [`reldor commit`](./docs/commit.md) | Clean commit: only your lines, even in files the retrieve also changed | ✅ |
| [`reldor quality`](./docs/quality.md) | Code your change repeats (copied blocks, queries, methods, texts) plus PMD and CPD | ✅ |
| [`reldor xml`](./docs/xml.md) | Sorts and removes duplicates in profiles, permission sets, labels, sharing rules, package.xml | ✅ |
| [`reldor hook install`](./docs/commit.md) | Pre-commit guard, also for commits made by hand | ✅ |
| [`reldor promote`](./docs/promote.md) | Promotion rehearsal: commit order, other people's commits, missing dependencies | ✅ |
| [`reldor merge`](./docs/merge.md) | Assisted merge into the merge branch: resolves conflicts, checks that only yours went in | ✅ |
| [`reldor rollback`](./docs/rollback.md) | Rollback plan for a PR: revert, `destructiveChanges.xml`, risks | ✅ |

</details>

### Skills

All skills are **model-invoked**: the AI reaches for them when the conversation fits.

- **[reldor](./skills/reldor/SKILL.md)**: The router. Finds out where you are and leads you to the next step.
- **[spec-review](./modules/sf/advisors/spec-review/SKILL.md)**: Points out what is missing in a spec before it runs.
- **[automation-design](./modules/sf/advisors/automation-design/SKILL.md)**: Recommends where a business rule should live.
- **[lwc-ux](./modules/sf/advisors/lwc-ux/SKILL.md)**: Proposes modern, accessible LWC screens before coding.
- **[task-refine](./modules/sf/advisors/task-refine/SKILL.md)**: Turns a task idea into a task written with the real impact: what changes, open questions, acceptance criteria and test scenarios.

## Safety

- Reads **metadata only**, never records.
- Tokens and credentials stay **out of the repository**.
- Every action is written to a **local history** (`reldor log`).
- **Git actions are off by default**: Reldor checks and advises, while creating branches, committing, merging and opening PRs stays with your own flow (for example, your team's workflow plugin). `reldor init` asks; turn them on only if you have no such tool.
- Deploying to production is **blocked by default**. Actions on task boards are **off by default**.
- Nothing about a client lives in Reldor: teams, prefixes and orgs stay in a profile inside the client's own repository.

## How it is built

A generic **core** plus one **module** per technology. Salesforce is the first module; mobile or web can follow without touching the core. Details in [architecture](./docs/architecture.md); the words we use are in the [glossary](./GLOSSARY.md); decisions are in [docs/adr](./docs/adr).

```
core/        cli, config, status, spec, git, log, report
modules/sf/  indexer, explain, checks, test-radar, refine, xml, security, quality, merge, promote, rollback, metadata, org, advisors
skills/      the AI's instructions, shared by Kiro and Claude Code
adapters/    thin per-IDE manifests
```

## Suggestions and problems

Open an [issue](https://github.com/marlonrodler/reldor/issues): an idea, a question or something that did not work. The code is maintained by the author; outside pull requests are not accepted.

## License

**Free to use at work, not open source.** © 2026 Marlon Rodler, under the [PolyForm Internal Use License 1.0.0](./LICENSE).

- ✅ You may use Reldor, and adapt it, in the internal operations of you and your company.
- ❌ You may not distribute it or modified versions, sell it, offer it as a service or build a competing product.

Other uses: talk to the author.
