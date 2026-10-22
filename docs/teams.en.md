<p align="center"><a href="./teams.md">Português</a> · <strong>English</strong></p>

# teams

## What it does

Tells Reldor how the name of a class, object or field shows the owning team. Every company does it its own way:
`VND_Order`, `OrderVND`, `OpportunitySalesService`, `vnd-screen`, or one folder per team. So Reldor **never guesses**: it
only suggests, and you confirm.

- **`reldor teams`** shows the confirmed teams and the **suggestions**: words that repeat in many names, in any position,
  with or without a separator (roles like `Service`, `Selector` and Salesforce names are left out). For each one, how many
  names, examples, and where it usually sits (start, end or middle).
- **`reldor teams add <name> --match <word> [--where start|end]`** confirms a team by a word of the name. Without
  `--where`, any position counts. For special cases: `--regex "<expression>"` or `--folder <part of the path>`.
- **`reldor teams remove <name>`** removes a team.

Teams live in `teams:` in `.reldor/reldor.config.yaml` (it goes to Git: it holds for the whole team). Your own team stays
only on your machine, with `reldor me --team <name>`.

```yaml
teams:
  - name: Sales
    match: vnd
    where: start
  - name: Campaigns
    folder: force-app/campaigns
```

## When to reach for it

Once per project, after `init`. The AI shows the suggestions and asks which word marks which team. Without confirmed
teams nothing is attributed to any team: [`helpers`](./helpers.en.md) treats everything as shared and `refine` does not
warn "this belongs to another team".

## It's working if

- `reldor teams` lists your teams with the number of classes, objects and fields of each.
- `profile.md` shows "Times e código compartilhado" with the right teams.
- In `refine`, a field of another team shows as "another team's", not yours.

## Common questions

**A suggestion is a word that is not a team** (e.g. a product name).
Just don't confirm it. A suggestion changes nothing.

**A name has the words of two teams.**
The first team in the list that matches wins.

## Where it fits

Project setup, next to [`init`](./init.en.md). It feeds [`helpers`](./helpers.en.md), [`refine`](./refine.en.md) and
`profile.md`.
