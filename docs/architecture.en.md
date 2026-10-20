<p align="center"><a href="./architecture.md">Português</a> · <strong>English</strong></p>

# Architecture

## The idea in one sentence
The **core** knows nothing about Salesforce. It asks **modules**: "detect", "index", "explain", "check". The `sf`
module is the first (and today the only) one to answer. A future module (mobile, web) would answer the same requests
without changing the core.

## How a question becomes an answer

```text
You talk → the AI (Reldor's skill) → runs the reldor command → scripts read the project's index
        ← the AI explains the result ← the command returns facts (JSON)
```

Three rules hold it together:
1. **Scripts find the facts, never the AI.** The automation chain, references and conflicts are computed by code, so
   they are repeatable and trustworthy. The AI only interprets the request and explains the result.
2. **Reldor reads metadata only**, never records.
3. **What belongs to the company stays in its repository's `.reldor/`**, never in Reldor.

## Three layers

| Layer | What it is | Uses tokens? |
|---|---|---|
| **`reldor` command** (Node.js) | Scripts: index, Git, org, XML, tests | No |
| **Skills** (`SKILL.md`) | Teach the AI to pick the command and explain the result | Yes, a little |
| **Manifests** (Kiro, Claude Code) | Tell each IDE which skills exist | No |

Skills are written once and serve both IDEs. The AI uses a skill when the conversation calls for it: the skill's
description says when. There are no IDE hooks or always-on rules; the only hook is Git's pre-commit, which you install if
you want (`reldor hook install`).

## One index, many uses

The index is a **summary** of the project (names and links, never records):

- per object: fields, validation rules, flows (type and entry criteria), triggers, record types, roll-ups, bypass
  switches (custom settings and custom metadata);
- who does DML on which object and which fields each class uses;
- the fflib chain, resolved from the `Application` class, and TriggerHandler-style handlers;
- cross references (who uses each method, field, class and flow).

It feeds: `explain`, `usages`, `refine`, `test-radar`, `check`, `review`, `promote` and `rollback`.

Refresh: on every command, the index reads again only the files that changed (size or date). `reldor index --full`
rebuilds everything. It lives in `.reldor/cache/` (outside Git) and rebuilds itself when the indexer code changes.

## Lives with the team's tools
Each module lists its **capabilities** (sort XML, remove duplicates, run the Code Analyzer, run tests...). The project
says in `tools:` when another tool already does one of them: `run` (Reldor does it), `verify` (Reldor only checks) or
`skip` (Reldor stays out). `reldor tools` looks for signs of those tools (Git hooks, pipelines, AI instructions,
`package.json` scripts) and suggests; the decision is always the person's. See [`tools`](./tools.en.md) and
[ADR 0004](./adr/0004-team-tools.en.md).

And nothing runs twice: a **run ledger** keeps each check's result by the content it reads. The hook, `review` and the
AI, asking for the same check over the same content, share the result.

## Specs
Reldor looks for specs in `.kiro/specs` and in `spec.path` from the config (folders with `requirements.md`,
`design.md` or `tasks.md`) and links a spec to the branch by name. It does not generate specs: when there is none, the
AI asks for the task or a description. It never makes one up.

## Git and promotion
- **Clean commit:** a snapshot after the retrieve; the commit takes only the "snapshot → now" difference, line by line.
- **Item-by-item metadata merge:** a merge driver for profiles, permission sets, labels and the like, installed in
  `.git/info/attributes` (only on your machine, nothing in the repository changes).
- **Assisted merge:** runs `git merge` on the merge branch, resolves conflicts keeping the target and applying only your
  change, and checks that only yours went in. It runs only when you ask; the merge commit, only with confirmation.
- **Promotion rehearsal:** simulates the merge without changing anything; checks dependencies and commit order.
- The environment chain comes from the config (e.g. develop → uat → producao), nothing hard-coded.
- **Git actions off by default:** Reldor does not create branches, commit or open PRs on its own.

## Repository folders

```
core/
├─ cli/           command entry points
├─ config/        reads the config, defaults
├─ status/        finds the current stage (used by the AI)
├─ doctor/        checks the installation and the terminal's folder
├─ tools/         team tools: who takes care of each capability
├─ runs/          run ledger (the same check never runs twice)
├─ spec/          finds specs
├─ modules/       loads modules (contract below)
├─ util/          running commands (Windows-friendly)
├─ git/           snapshot, clean commit, commit order
├─ report/        terminal output
└─ log/           action history
modules/sf/
├─ org/           confirm the org, retrieve, run tests, production protection
├─ indexer/       force-app → index (parsers, incremental cache, fflib chain)
├─ explain/       reverse engineering and test scripts
├─ checks/        where it is used, dynamic fields, field outside the query
├─ refine/        task refiner
├─ test-radar/    tests affected by a change
├─ security/      security review (own rules + Code Analyzer)
├─ quality/       repeated code (own rules + PMD and CPD)
├─ xml/           XML organizer (rules per type)
├─ merge/         item-by-item merge and assisted merge
├─ promote/       promotion rehearsal and collision radar
├─ rollback/      rollback plan
├─ metadata/      metadata types by path
├─ tools.js       the module's capabilities and team-tool detection
└─ advisors/      advisors (skills): spec-review, automation-design, lwc-ux, task-refine
```

## Module contract
`name`, `label`, `matches(root)`, `detect(root)`, `statusLines(facts)`, `profileLines(facts)` and, optional,
`alerts(...)` (`status` warnings), `doctorChecks(root)` (what `doctor` checks), `capabilities` and `detectTools(root)`
(what `tools` shows).

## Advisors
Each advisor is **a skill**, with no code in the core. The AI uses one when the conversation calls for it (creating an
automation or a screen, reviewing a spec, writing a task), and the advisor runs Reldor commands to get the facts. New
advisors are new folders in `advisors/`.

## The client project

```
.reldor/
├─ reldor.config.yaml   ✅ Git (environments, team tools, rules)
├─ profile.md           ✅ Git (project patterns, written by the team)
├─ cache/               ❌ out (index, run ledger)
├─ work/                ❌ out
└─ log/                 ❌ out
```
