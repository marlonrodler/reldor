<p align="center"><strong>English</strong> · <a href="./architecture.pt-BR.md">Português</a></p>

# Architecture

## The idea in one sentence
The **core** knows nothing about Salesforce. It asks **modules** to "detect", "index", "explain" and "check".
The `sf` module answers first. A future module (mobile, web) answers the same requests without changing the core.

## Three layers

| Layer | What it is | Spends tokens? |
|---|---|---|
| **`reldor` core** (Node.js) | Scripts: index, Git, org, XML, tests | No |
| **Skills** (`SKILL.md`) | Teach the AI to guide and explain | Yes, a little |
| **Adapters** (Kiro, Claude Code) | Each IDE's manifest and hooks | No |

Skills are written once and work in both IDEs. Adapters stay thin because IDE formats change.

## One index, many uses

The index is a **summary** of the org (names and links, never code bodies or records):

- per object: fields, validation rules, flows (type and entry criteria), triggers, record types, roll-ups,
  bypass switches (custom settings and custom metadata);
- which class writes to which object and which fields each class uses;
- the fflib chain, resolved from the `Application` class;
- cross references (who uses each method, field, class and flow).

It feeds: task refinement, reverse engineering, AI context, test radar, query checks, safe delete,
promotion rehearsal and rollback.

Refresh: on every command, the index reads again only the files that changed (size or date). `reldor index --full`
rebuilds everything. It lives in `.reldor/cache/` (outside Git).

## Where the AI comes in
Only to **interpret** (read the task or the spec) and to **explain** (write the result in the conversation's language).
The automation chain, the references and the conflicts are computed by scripts, so they are reliable and repeatable.

## Where the spec comes from
1. **Detected:** an existing spec (Kiro or another spec generator).
2. **Configured:** runs the generator the team set up.
3. Otherwise it **asks for the task or a description**. It never makes one up.

## Git and promotion
- **Clean commit:** a snapshot on every retrieve; the commit takes only the "snapshot → now" difference.
- **Smart merge:** a per-item merge driver (permission, field, label), installed in `.git/info/attributes`,
  without changing the repository and without creating commits.
- **Promotion rehearsal:** simulates the merge in a separate folder; checks dependencies and commit order.
- The environment chain comes from the config (e.g. develop → uat → production), nothing hard-coded.

## Repository layout

```
core/
├─ cli/           command entry points
├─ config/        reads config + profile, defaults
├─ status/        finds the current step (used by the AI)
├─ spec/          where the spec comes from
├─ modules/       loads modules (contract: detect, statusLines, profileLines)
├─ util/          runs commands (Windows-friendly)
├─ git/           snapshot, clean commit, pre-commit, commit order
├─ report/        output helpers (guardian tone)
├─ log/           action history
├─ automations/   (reserved) WHEN / IF / DO
└─ connectors/    (reserved) Monday, Azure DevOps, Jira
modules/sf/
├─ org/           confirm org, retrieve, deploy, production lock
├─ indexer/       force-app → index (parsers, incremental cache, fflib chain)
├─ explain/       reverse engineering and test scripts
├─ refine/        task refinement
├─ test-radar/    tests affected by a change
├─ checks/        queries, limits, safe delete (usages)
├─ xml/           XML organizer (rules per type)
├─ merge/         per-item merge driver
├─ promote/       promotion rehearsal, environment map
├─ rollback/      rollback plan
├─ frameworks/    fflib, generic trigger handler
└─ advisors/      advisors (skills): spec-review, automation-design, lwc-ux
```

## Advisors
Each advisor is **one skill**, with no code in the core. New advisors (integration, security) are new folders in
`advisors/`.

"Want me to check this first?" uses an always-on steering rule plus Kiro and Claude hooks that fire when a spec is
created or a run starts. It only asks when it finds something relevant, with `off`, `ask` and `auto` modes.

## The client's project

```
.reldor/
├─ reldor.config.yaml   ✅ in Git
├─ profile.md           ✅ in Git
├─ cache/               ❌ ignored
├─ work/<task>/         ❌ ignored
└─ log/                 ❌ ignored
```
