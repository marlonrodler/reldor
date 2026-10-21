<p align="center"><a href="./promote.md">Português</a> · <strong>English</strong></p>

# promote

## What it does

`promote <environment>` is a **rehearsal**: it shows what happens if your branch is merged into the branch of that environment, before you create the merge branch and the pull request. Nothing in your repository changes.

| Check | What it tells you |
|---|---|
| Commits that go along | Exactly what the merge takes to the environment |
| Order | Commits that have not gone through the previous environment yet. The pipeline blocks these |
| Other people's commits | Commits by someone else that would go along, usually because develop was merged or pulled into your branch |
| Conflicts | Each conflicting file. Profiles, permission sets, labels and similar files are tried item by item: most of them are not real conflicts |
| Missing dependencies | Fields, objects and classes your changes use that will not exist in the environment after the merge, and where they do exist ("only in develop") |

At the end it shows the next step in the team's flow: create the merge branch from the environment, `git merge` your branch, open the PR.

Without an environment name, it picks the first environment your branch has not reached yet. The environments and their order come from `.reldor/reldor.config.yaml`.

## Smart merge

`reldor merge install` turns on, after asking for confirmation, for this repository and only on your machine, a Git merge driver for profiles, permission sets, muting permission sets, labels, translations, sharing rules, value sets and `package.xml`. It runs inside the normal `git merge` (also from VS Code):

- items changed on only one side are joined;
- a real conflict happens only when both sides changed **the same item** differently, and only that item gets conflict markers;
- the result comes out sorted, as Salesforce retrieves it.

It also turns on `git rerere`: Git remembers how you resolved a conflict and repeats it in the next environment. Useful because the conflict is resolved in each environment's merge branch, so it shows up again in UAT and in master.

Nothing goes to the shared repository: the settings live in `.git/info/attributes` and `.git/config`. `reldor merge uninstall` removes them.

## When to reach for it

Say "I want to take this to UAT". The AI runs the rehearsal, explains each problem and offers the next step.

## It's working if

- The pipeline stops failing because of commit order or a field that only exists in develop.
- Profile conflicts stop taking time.

## Common questions

**Does it need a recent Git?**
With Git 2.38 or newer it simulates the merge in memory. Older Git works too, using a temporary worktree outside your folder.

**It says "other people's commits", but we are a pair.**
Then everything is fine. The check compares the commit author with your `user.email`.

**Should I fix the conflict in my branch before?**
No. Conflicts are resolved in the merge branch, as usual: fixing them in your development branch would pull in other people's work. The rehearsal only tells you in advance, so it is not a surprise.

**Does it replace the pipeline?**
No. It runs the same kind of checks earlier, on your machine, so the pipeline does not fail.

## Where it fits

After [commit](./commit.en.md) and [test-radar](./test-radar.en.md), before the pull request. It uses the same item rules as the [XML organizer](./xml.en.md).
