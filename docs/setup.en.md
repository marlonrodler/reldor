<p align="center"><a href="./setup.md">Português</a> · <strong>English</strong></p>

# setup

## What it does

One command to install and get Kiro ready:

```bash
npx github:marlonrodler/reldor setup
```

1. **Installs Reldor** for your user (`npm install -g`, no admin).
2. **Connects Reldor to Kiro as an MCP server** (`~/.kiro/settings/mcp.json`): the AI calls Reldor directly, without the terminal. No more repeated commands ("reldorreldor"), no waiting until Kiro gives up, no "--out". Reads run without asking for approval; what changes files still asks.
3. **On Windows, puts the npm folder in the PATH of Kiro's terminals only** (in Kiro's own settings): without touching Windows variables and without asking IT.

Before changing anything, it shows the list and asks for a "yes". Each Kiro file it changes gets a `.reldor-backup` copy. Run it again any time: what is already right is skipped.

The Reldor power (step 3 of the README) is still imported in Kiro: it is what teaches the AI to use Reldor.

## When to reach for it

Once, right after reading the README. Again to update.

## It's working if

- In Kiro, Reldor answers without the command showing up in the terminal.
- `reldor --version` works in Kiro's terminals.

## Common questions

**MCP is blocked by the company.**
Everything keeps working through the terminal, as before; the AI is just slower.

**It said it could not read a Kiro file.**
The file has something it does not understand, so it leaves it alone. It shows the line for you to paste by hand.

## Where it fits

It is step 2 of the installation. Then [`doctor`](./doctor.en.md) checks everything.
