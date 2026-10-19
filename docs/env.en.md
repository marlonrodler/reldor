<p align="center"><a href="./env.md">Português</a> · <strong>English</strong></p>

# env

## What it does

The environment chain is **configuration, not code**. Each project says, in `.reldor/reldor.config.yaml`, which environments it has, in which order, and which branch each one uses. Any names, any branches, any number of environments.

`reldor env` shows the chain and lets you change it:

```
1. pre-uat → develop/time-a
2. uat → release/uat
3. producao → master  (produção, deploy bloqueado)

• As branches de desenvolvimento nascem de: master
• Nome sugerido da branch de merge: merge/{feature}-{env}
```

| To change | Command |
|---|---|
| The chain (order = promotion order) | `reldor env set "pre-uat:develop/x, uat:rc/uat, prod:master"` |
| Which environment is production (deploy blocked) | `reldor env --production prod` (default: the last one) |
| Where development branches start | `reldor env --base master` (default: the production branch) |
| Merge branch name pattern | `reldor env --merge-branch "merge/{env}/{feature}"` |
| Rollback branch name pattern | `reldor env --rollback-branch "rollback/{id}"` |

Orgs (`org:`) of environments with the same name are kept when you change the chain.

## When to reach for it

Once per project, and whenever the team's branches change. Say "change the environments to ...". Commit `.reldor/reldor.config.yaml` so the whole team uses the same chain.

## It's working if

- `status`, `promote`, `merge` and `rollback` speak your team's environment names and branches.

## Where it fits

[init](./init.en.md) asks for the chain the first time; `env` changes it later.
