<p align="center"><strong>English</strong> · <a href="./init.pt-BR.md">Português</a></p>

# init

## What it does

`init` sets Reldor up in a project in one step. It detects what it can on its own (the Salesforce project, the `sf` CLI, the default org, fflib, existing specs and branches) and asks only three things: the environment branches in promotion order, the reference org, and whether the team follows SLDS. It writes `.reldor/reldor.config.yaml` and `.reldor/profile.md`, and adds Reldor's local folders to `.gitignore`.

The last environment (production) is always marked as blocked for deploys.

## When to reach for it

Say "I want to use Reldor" in a new project and the AI runs it for you, asking the three questions in the chat. In the terminal: `reldor init`, or `reldor init --yes --envs develop,rc/uat,master --org uat --design-system slds`.

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
