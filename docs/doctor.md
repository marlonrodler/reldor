<p align="center"><strong>English</strong> · <a href="./doctor.pt-BR.md">Português</a></p>

# doctor

## What it does

`doctor` checks that everything is ready to use Reldor **in the folder the terminal is in**, and gives one next step. It changes nothing, it only looks:

- **On the computer:** Node.js (18 or newer), Git, Salesforce CLI, and the optional tools (Code Analyzer, GitHub CLI). It also shows where Reldor is installed and the command to update it.
- **In the AI:** whether it found the Reldor plugin in Kiro or Claude Code.
- **In this folder:** whether it is a Salesforce project, a Git repository, and whether Reldor is already set up. It warns when the terminal is in Reldor's own folder instead of the project's.

## When to reach for it

Right after installing, and whenever something does not work. Open the project folder in VS Code, open the terminal (**Terminal → New Terminal**) and run `reldor doctor`. The AI can also run `reldor doctor --json` when a command fails.

## It's working if

- It ends with "Tudo pronto" or with a step you can follow without looking anything up.
- Every missing item comes with the command that fixes it.

## Common questions

**It says it didn't find the plugin, but I installed it.**
It looks in the known Kiro and Claude Code folders. If your AI already knows Reldor (it answers "I want to use Reldor"), you can ignore it.

**It says the folder is synced (OneDrive).**
Reldor was cloned into a OneDrive folder, and syncing slows everything down. Install it with npm (`npm install -g github:marlonrodler/reldor`) and delete the cloned folder.

## Where it fits

It is the first command after installing. When it says everything is installed, the next step is to talk to the AI: "I want to use Reldor", which runs [`init`](./init.md).
