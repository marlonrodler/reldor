<p align="center"><a href="./output.md">Português</a> · <strong>English</strong></p>

# output

## What it does

Every answer of a Reldor command is also kept in a file, in `.reldor/work/output/` (out of Git):

- one file per command, always overwritten: `status.json` (with `--json`) or `status.txt`;
- they **go away on their own** when the task or its phase changes (refine → develop → promote), and when older than 7 days;
- nothing is asked before deleting: they are only copies of the answers. The task's `refine.json` is not here and is kept.

**`reldor output`** lists the saved files; **`reldor output --clear`** deletes them all now.

At the end of each command, in an IDE terminal (VS Code, Kiro), Reldor also sends the invisible "command finished" signal
those terminals understand. In a terminal without that feature (cmd, restricted PowerShell), it is what keeps the AI from
waiting. To turn it off: `RELDOR_NO_TERMINAL_SIGNAL=1`.

## When to reach for it

You almost never use it: it is for the AI. If the IDE terminal returns the command mixed up (`reldorreldor`) or does not
show the answer, the AI reads `.reldor/work/output/<command>.json` instead of running it again. Through MCP the answer
already goes straight to the AI, so nothing is kept.

## It's working if

- After `reldor status --json`, `.reldor/work/output/status.json` exists.
- After switching tasks, the folder starts empty again.

## Where it fits

Behind every command. `--out <file>` still exists for those who want to pick the file.
