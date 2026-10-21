<p align="center"><a href="./init.md">Português</a> · <strong>English</strong></p>

# init

## What it does

`init` sets Reldor up in a project in one go, **without asking anything**. It finds what it can (the Salesforce project, the `sf` CLI, the `sf` default org, the specs) and saves only that:

- `.reldor/reldor.config.yaml`: the modules, the `sf` default org as the reference org (if there is one), the design system (`slds`, unless you say otherwise) and `execute: off`;
- `.reldor/profile.md`: the project profile (see below);
- Reldor's local folders (cache, log, work) in `.gitignore`.

Environment branches and the org are **not asked up front**: only some commands need them, and those ask at that moment (for example, `retrieve` without an org says "Which org? Run again with --org <alias>"). To write them down, use [`env`](./env.en.md). After saving, it looks for signs of team tools that already do part of its work and suggests [`tools`](./tools.en.md).

With `execute: off`, Reldor runs nothing in Git or in the org: it checks and shows the ready commands for you to run.

### profile.md

It is what the AI and the team read about the project. It has two parts:

- **the automatic part**, between the `reldor:auto` markers, read from the project index (every file): package folders, API version, how many classes (and test classes), triggers, flows, LWCs and objects, whether it uses fflib (how many services, selectors and domains), trigger handlers and the most used base, how test classes end, the most common name prefixes and how many classes declare sharing;
- **"Padrões da equipe"** (team standards), with topics for the team to fill in (prefixes per team, shared classes, when to use Flow or Apex, naming rules). Reldor never changes this part.

`reldor profile` rereads the project and rewrites only the automatic part. To fill in the team's part, ask the AI: "help me fill in the Reldor profile". It shows what Reldor found and asks for the rest.

## When to reach for it

Say "I want to use Reldor" in a new project and the AI runs it for you. In the terminal: `reldor init`. Every option is optional: `--envs "pre-uat:develop/x, uat:rc/uat, prod:master"`, `--org <alias>`, `--design-system <name>`, `--execute on`.

## It's working if

- A new dev is ready in a minute, without answering anything.
- `profile.md` shows the project's real numbers (classes, triggers, fflib).

## Common questions

**Do I commit `.reldor/`?**
Commit `reldor.config.yaml` and `profile.md`: they are for the whole team. The cache, work and log folders stay out of Git.

**profile.md is out of date.**
Run `reldor profile`. The team's part stays as it is. An old `profile.md`, from before the markers, keeps everything from "## Padrões da equipe" on.

**How do I change the config?**
Environments and org with [`env`](./env.en.md); the rest by editing the YAML or with `reldor init --force`.

## Where it fits

Runs once per project. Everything else reads what it saves.
