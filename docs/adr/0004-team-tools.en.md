<p align="center"><a href="./0004-team-tools.md">Português</a> · <strong>English</strong></p>

# 0004 · Team tools and running once

A company that already works with Salesforce usually has tools that do part of what Reldor does: a plugin that sorts
and removes duplicates from profiles, a pipeline that runs the Code Analyzer and the tests, a commit hook. Running the
same thing twice wastes time, and two tools rewriting the same file can fight.

Decision:
- Each module declares its **capabilities**. The project picks, in `tools:` of `.reldor/reldor.config.yaml`, a mode for
  each one: `run` (Reldor does it), `verify` (Reldor only checks, without redoing it) or `skip` (Reldor stays out and says
  who takes care of it). Capabilities that act outside the files (running tests, installing a hook or merge driver) take
  only `run` or `skip`.
- The module looks for **signs** of those tools in the project and suggests. Nothing is saved without the person
  deciding, and what belongs to the client stays in the client's repository.
- A **run ledger** keeps each check's result by the fingerprint of what it reads (file content, index, base commit,
  options and Reldor version). The same check over the same content does not run twice.
- All of this is computed by scripts (ADR 0002). The skill only reads the result and asks.

Consequences: `review`, the hook and the commands follow the modes; what is left out is always listed, never hidden.
Commands that change something only act on another tool's capability with `--force`.
