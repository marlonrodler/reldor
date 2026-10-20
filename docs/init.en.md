<p align="center"><a href="./init.md">Português</a> · <strong>English</strong></p>

# init

## What it does

`init` sets Reldor up in a project in one step. It detects what it can on its own (the Salesforce project, the `sf` CLI, the default org, fflib, existing specs and branches) and asks only four things: the environment branches in promotion order, the reference org, whether the team follows SLDS, and whether you already use a tool that creates branches, commits and opens PRs. It writes `.reldor/reldor.config.yaml` and `.reldor/profile.md`, and adds Reldor's local folders to `.gitignore`.

The last environment is production and stays protected: Reldor never deploys, and the `test-radar --run` tests refuse to run there (unless `--allow-production`). After saving, it looks for signs of team tools that already do part of its work and suggests [`tools`](./tools.en.md).

## When to reach for it

Say "I want to use Reldor" in a new project and the AI runs it for you, asking the questions in the chat (environments, reference org, design system, and whether you already have a tool that creates branches, commits and opens PRs: if yes, Reldor's Git actions stay off). In the terminal: `reldor init`, or `reldor init --yes --envs develop,rc/uat,master --org uat --design-system slds --git-actions off`.

## It's working if

- A new developer is ready in a few minutes.
- `reldor status` shows the right environments and spec right after.

## Common questions

**Do I commit `.reldor/`?**
Commit `reldor.config.yaml` and `profile.md`: they belong to the whole team. The cache, work and log folders stay out of Git.

**How do I change the answers?**
Edit the YAML, or run `reldor init --force`.

## Where it fits

It runs once per project. Everything else reads what it writes.
