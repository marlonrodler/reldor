<p align="center"><a href="./roadmap.md">Português</a> · <strong>English</strong></p>

# Roadmap

Each phase starts only when the previous one meets its exit criterion.

| Phase | Delivers | Done when | |
|---|---|---|---|
| **0 · Foundation** | `init`, `status`, `log`, skills and the Kiro and Claude Code plugins | The AI describes your current situation without mistakes | ✅ |
| **1 · Knowledge and advisors (MVP 1)** ✅ in code | Index ✅, reverse engineering (`explain`) ✅, where it is used (`usages`) ✅, advisors ✅, test radar ✅, query check ✅, task refinement ✅ | A senior dev validates the chain of 3 real processes | 🚧 |
| **2 · Development and Git (MVP 2)** | Query check ✅, security review ✅, quality review ✅, org confirmation ✅, clean commit ✅, XML organizer ✅, pre-commit guard ✅, smart merge ✅, `rerere` ✅, promotion rehearsal ✅, assisted merge ✅, clean before commit ✅, rollback plan ✅, installation check (`doctor`) ✅, team tools and running once (`tools`) ✅ | 2 weeks without a wrong merge or commit | 🚧 |
| **3 · Pilot and measurement** | Real use by one developer, with the client's permission | Gains measured and the developer wants to keep it | |
| **4 · Broaden and expand** | A context summary for the AI before coding, test data factory, executed rollback, error analysis, deploy checklist, Quick Deploy, drift, automatic docs, connectors, shared index, other clients | | |

## Quick win (today)
Turn on `git rerere` to replay repeated conflicts across environments:

```bash
git config --global rerere.enabled true
```
