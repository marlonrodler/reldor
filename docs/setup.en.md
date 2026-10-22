<p align="center"><a href="./setup.md">Português</a> · <strong>English</strong></p>

# setup

## What it does

One command to install Reldor and connect it to the AI tools on this machine:

```bash
npx github:marlonrodler/reldor setup
```

It **asks before each change**, one at a time:

1. **Install Reldor** for your user (`npm install -g`, no admin).
2. **Register Reldor as an MCP server in Kiro** (`~/.kiro/settings/mcp.json`), if Kiro is installed: the AI calls Reldor directly, without a terminal.
3. **On Windows, put the npm folder in the PATH of Kiro's terminals only** (in Kiro's own settings), without touching Windows variables.
4. **Register Reldor as an MCP server in Claude Code** (`claude mcp add --scope user`), if Claude Code is installed.

What it does **not** do: it does not change the default terminal and does not touch permissions. Your AI keeps asking for approval before running a command, as you set it.

Each file it changes gets a `.reldor-backup` copy, and what it did is written in `~/.reldor/setup.json`. Run it again any time: what is already right is skipped. With `--yes`, it accepts every question.

**`reldor setup --undo`** removes exactly what setup added: the MCP server (Kiro and Claude Code) and the PATH of Kiro's terminals. It also removes what version 0.25 added: the automatic approval of `reldor ...` commands in Kiro's permissions and, in a separate question (it may have been your own choice), Git Bash as the default terminal. The program stays installed; to remove it too: `npm uninstall -g reldor`.

The Reldor power (step 3 of the README) is still imported in Kiro: it is what teaches the AI to use Reldor.

## When to reach for it

Once, right after reading the README. Again to update. `--undo` to put your AI back as it was.

## It's working if

- In Kiro or Claude Code, Reldor answers without the command showing up in the terminal.
- `reldor --version` works in Kiro's terminals.

## Common questions

**MCP is blocked by the company** (Kiro shows "1 server hidden · MCP Registry").
The company only allows the servers on its list. Everything keeps working through the terminal: each command's answer is also kept in `.reldor/work/output/` (see [`output`](./output.en.md)), and the AI reads it from there if the terminal garbles it. To use MCP, IT has to add Reldor to the list.

**It said it could not read a file.**
The file has something it does not understand, so it leaves it alone. It shows the line for you to paste by hand.

## Where it fits

It is step 2 of the installation. Then [`doctor`](./doctor.en.md) checks everything.
