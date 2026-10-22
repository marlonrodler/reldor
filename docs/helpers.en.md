<p align="center"><a href="./helpers.md">Português</a> · <strong>English</strong></p>

# helpers and me

## What it does

**`reldor helpers <term>`** shows the public methods that **already exist** for that, before you (or the AI) write another one. It searches the words in the method name, the class name and the parameters, and shows **shared code** first (classes that belong to no confirmed team, like `StringUtils` or a Selector), then what is in team classes, with the signature and file:line.

**`reldor helpers --similar`** shows methods with the same name in **different teams**: two teams wrote the same thing. Each group is a candidate to become one generic method in a shared class. Methods that repeat on purpose (same base class or same interface) are left out.

**`reldor me --team <name>`** saves your team **only on your machine** (`.reldor/local.yaml`, which is in `.gitignore`).

Who owns each name comes only from the project's **confirmed teams** ([`reldor teams`](./teams.en.md)). Reldor doesn't guess: each company marks the team its own way (at the start, middle or end of the name, with or without `_`, by folder). Without confirmed teams, `--similar` compares classes without saying whose each one is. Everything comes from the project index: no org, no AI.

## When to reach for it

The AI uses it by itself before creating a method: "I need a method that formats a tax ID" → `reldor helpers format taxid`. If it already exists in shared code, it uses that. If it only exists in another team's class, it suggests moving it to shared code instead of copying. If it doesn't exist and another area may need it, it suggests a **generic** method: what changes becomes a parameter (the object, the field, the Ids, the options), in a shared class.

In the terminal: `reldor helpers format`, `reldor helpers --similar`, `reldor me`, `reldor me --team sales`.

## It's working if

- Teams stop creating the same method each with their own prefix.
- Someone new on a team finds the helper that already exists instead of writing another.

## Common questions

**Our team doesn't use a prefix.**
Then don't confirm teams: everything shows up as shared, and `helpers` still finds the methods that already exist. If the team shows in the folder, use `reldor teams add <name> --folder <folder>`.

**Why doesn't my team go into profile.md?**
Because `profile.md` belongs to the whole team, and each person is on one team. Yours stays in `.reldor/local.yaml`, out of Git.

## Where it fits

During development, before writing new code. The patterns the AI follows are in [`profile.md`](./init.en.md#profilemd); copying that slips through shows up in [`quality`](./quality.en.md).
