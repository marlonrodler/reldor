<p align="center"><a href="./CHANGELOG.md">Português</a> · <strong>English</strong></p>

# Changelog

## 0.20.1

- `reldor init --json` returns JSON (it used to print text, and the AI could not read the `--out` file).
- Skill and power: when the IDE terminal mixes up or repeats the command and not even the `--out` file shows up, the AI
  stops trying and asks the person to run it and paste the result (and checks the installed version).

## 0.20.0

- **Execution off** (`execute: off`, the default): Reldor runs nothing in Git or in the org. `commit`, `clean`, `merge`,
  `retrieve`, `test-radar --run` and `rollback` check and hand over the ready commands, for the person to run. Commit and
  clean take only your lines in an already checked patch. `execute: on` (or the old `git.actions: on`) makes Reldor run
  them, always with confirmation.
- Confirmation for file changes: `xml`, `merge --resolve` (new), `hook install` and `merge install` show what they will
  change and ask for a "yes". With no terminal (an AI) and no `--yes`, the answer is no.
- `reldor deploy` (new): builds the validation (`--dry-run` with the radar's tests), the quick deploy and the direct deploy
  of the changed files. Never runs them. In production, only the validation; deleted files are listed.
- `reldor init` asks nothing: it saves only what it detected. Environments and the org are asked for when a command needs
  them (`reldor env --org <alias>`, `--org-for "<environment>:<alias>"`).
- `profile.md` read from the project index (every file): classes, tests, triggers, flows, LWCs, objects, fflib with
  services, selectors and domains, trigger handlers, test suffix, prefixes and sharing. `reldor profile` (new) refreshes
  that part without touching "Padrões da equipe", which now has topics for the team to fill in, with the AI's help.

## 0.19.2

- `status` (and everything that detects the project) no longer runs `sf` to know whether it exists and which org is the
  default: it finds `sf` on the PATH and reads the version and the org from its files. From ~10 seconds to under 1 (more on
  Windows).
- `--out <file>` on any command: the result goes to the file and the terminal shows one line. For AI terminals that lose
  output; the skill and the power use it by themselves when the output does not come back.

## 0.19.1

- Kiro: the plugin also ships the older power format (`POWER.md` and `steering/`), generated from the same skills. Kiro versions
  that asked for `POWER.md` now activate Reldor. To update, remove the power and import it again.
- Windows install: the README explains how to put npm's folder on the PATH from cmd and what to do with a restricted
  PowerShell (`reldor.cmd`). The skill and the power know the same.

## 0.19.0

- `reldor tools`: Reldor lives with the team's tools. Each thing it does is a capability (`xml-duplicates`, `xml-order`,
  `org-files`, `security`, `quality`, `code-analyzer`, `queries`, `affected-tests`, `run-tests`, `pre-commit`,
  `profile-merge`), and the project picks in `tools:` whether Reldor does it (`run`), only checks without redoing it
  (`verify`) or stays out (`skip`). It looks for signs of those tools (Git hooks, pipelines, AI instructions,
  `package.json` scripts, a merge driver in `.gitattributes`) and suggests, showing the line; nothing is saved by itself.
- `review`, the pre-commit hook, `xml`, `security`, `quality`, `check`, `test-radar`, `clean`, `hook install` and
  `merge install` follow the modes. What stays with another tool shows in the result with its name. Commands that change
  something only act on another tool's capability with `--force`.
- Running once: the same check over the same content runs once (security and quality rules, Code Analyzer, affected
  tests, queries, XML). The hook, `review` and the AI share the result (♻️). `--fresh` redoes it.
- `status`, `doctor` and `init` warn when there are signs of team tools not decided yet.
- Coherence: config keys that did nothing were removed (`spec.generator`, `advisors.mode` and `enabled`, `xml.types`,
  `index.depth`, `git.clean_commit`, `pre_commit_hook`, `smart_merge`, `test_radar.auto_run`, `automations`,
  `connectors`), and so were the empty folders that promised features. Skills no longer ask to run commands that do not
  exist (`reldor context`, `reldor ask`). The README and architecture describe only what Reldor does today, with a
  diagram of how it works and the Git section rewritten.

## 0.18.0

- Docs are Portuguese first: every document is `<name>.md` in Portuguese and `<name>.en.md` in English (README,
  CHANGELOG, glossary, AGENTS, docs, ADRs, advisors). A test checks that every document has both.
- README rewritten: what Reldor is in one minute, two ways to install (npm or `git clone`), Kiro and Claude Code step by
  step, the first command and common problems.
- Kiro guide: from the GitHub link or from the cloned folder.

## 0.17.1

- Security: `fast-xml-parser` 4 → 5.11 and `yaml` 2.5 → 2.9, closing the advisories `npm audit` reported (1
  critical, 1 moderate). The parsed result is the same as before on 9,716 metadata files from 16 public projects.

## 0.17.0

- Installation in one line, no folder to choose: `npm install -g github:marlonrodler/reldor` (the same line updates).
- Kiro installs from a link: the ready plugin is committed in `plugins/kiro/reldor` (Powers → Import power from
  GitHub). `npm run build:adapters` keeps it current and a test checks it.
- `reldor doctor`: checks Node.js, Git, the sf CLI, the optional tools, how Reldor was installed, the AI plugin and the
  terminal's folder (a project, Git, set up, or Reldor's own folder by mistake), and gives one next step.
- README: installation rewritten step by step (where it lives, which terminal, which folder, the first command, common
  problems such as the PowerShell script policy).

## 0.16.1

- The task-refine advisor shows how the request was understood (`detected.why`), asks for confirmation only when a
  name was matched by its last word or named inside another one, and puts a similar existing rule first.

## 0.16.0

- `refine` reads a request written in Portuguese against English labels: a business glossary, plurals, reversed word
  order and API names split into words. The longest name wins ("entrega de serviço" is Service Delivery; Service is
  listed as named inside it), a name said by its last word only is used when one object ends that way, standard
  objects count even without metadata in the project, and the answer starts with "Entendi assim" (which word led to
  which object). On 62 requests over 9 projects: 119/119 objects found, none extra.
- `refine` points to existing rules that look like the request ("Já existe algo parecido").

## 0.15.0

- `usages` for a field adds "Campos dinâmicos", the developer's second look at what code reaches only by name:
  objects that keep field names (custom metadata, custom settings, config objects, FieldDefinition relationships)
  and the classes that use those names (`record.get(name)`, describe maps, `Database.query(text)`); for custom
  metadata, the records in the project that name the field; for custom settings and objects, a ready SOQL to check
  the org (Reldor reads no data); and every text in code that names the field without its object.
- The project's own namespace prefix is understood (`npsp__Amount__c` is `Amount__c` in an `npsp` project).
- Report type tables follow child relationships even when a lookup has the same relationship name.

## 0.14.0

- `usages` knows which object each field belongs to. A field with the same name on several objects (`Status__c`,
  `Contact__c`) is no longer mixed up: every use is tied to its object by the variable's type, the query's `FROM`
  (subqueries and semi-joins too), `new Account(...)`, `Parent__r.Field__c` paths, the flow element or `$Record`, the
  screen's form or imports, the report column, the layout's related list, and so on. Uses of the same name on other
  objects are listed apart ("Fora da lista"), and what code cannot tell (a field name in a string handed to dynamic
  code) is shown as "possível" with the reason and the candidate objects. Nothing is left out silently.
- `usages` reads Apex, triggers, flows, LWC, Aura, Visualforce, layouts, record types, permissions, reports, report
  types, dashboards, quick actions, record pages, field sets, sharing sets, custom metadata records and rules from
  the index; the slower file sweep is gone.
- `test-radar`: tests that only build records in memory no longer count as "saves"; a `delete` does not count for
  validation rules. A test that saves another object whose trigger, flow or roll-up saves the changed one is found
  ("salva Contact, e a trigger X de Contact grava Account"). A changed field also brings the tests that use it in
  code; a changed record type, the tests that use its name; a changed class, the tests that name it in a string.
- DML is read per method with the variable's declared type (`List<Account>`, `Map<Id, Account>`, casts, lower case
  `list<account>`), so "who saves this object" is exact.
- The index is rebuilt by itself whenever the indexer code changes.

## 0.13.0

Fixes from a full run over 16 large public Salesforce projects (NPSP, EDA, PMM, Outbound Funds, Volunteers for
Salesforce, the Salesforce sample apps and more).

- Index: Apex methods named like JavaScript built-ins (`toString`, `valueOf`) no longer break the class.
- Index: a `//` or `/*` inside an Apex string (`'image/*'`, `'https://...'`) is no longer read as a comment (it hid the
  rest of the class). Classes and objects whose names start in lower case (`mc_Recipients`, `npe01__X__c`) are found,
  and names compare without letter case, as in Apex.
- `usages`: a formula or validation rule that reads `Parent__r.Field__c` counts for the field on the parent object,
  not for a field with the same name on the object itself.
- `usages`: a second pass for custom fields finds reports, report types, dashboards, field sets, Lightning pages,
  quick actions and prompt templates (certain), LWC/Aura/Visualforce by name (likely) and field names inside Apex
  strings (possible).
- `test-radar`: test data factories are followed method by method, through chains. A test that calls a factory method
  is high priority; a factory class that creates many objects no longer pulls in every test. `@isTest` classes with no
  test methods are not listed as tests.
- `clean --undo` keeps the snapshot, so the same retrieve can be cleaned again.
- The pre-commit hook calls this Reldor by absolute path (an old `reldor` on the PATH could block commits).
- `quality --all`: one finding per repeated text, query, method pair and pair of files with copied blocks, instead of
  one per occurrence. The code between two short strings is no longer taken for a repeated text.
- `rollback`: the `-meta.xml` next to a class or trigger goes with it instead of being listed as unknown.
- `security`: fewer false alarms. Test classes, placeholder "secrets" (`{0}`, `%s`), Visualforce `escape="false"` on
  labels or literals, `lwc:dom="manual"` on canvas/svg and data classes with only `@AuraEnabled` properties are no
  longer flagged.

## 0.12.0

- The environment chain is fully configurable: any names, branches and number of environments; any of them can be
  production (`production: true`, default the last one); `git.base_branch` says where development branches start;
  `git.merge_branch` and `git.rollback_branch` are name patterns (`{feature}`, `{env}`, `{id}`).
- `reldor env`: shows the chain and changes it (`set "name:branch, ..."`, `--production`, `--base`,
  `--merge-branch`, `--rollback-branch`), keeping the orgs already set.

## 0.11.0

- `reldor review`: one review before the commit, with one summary: security, quality and repeated code, fields read
  outside the query, tests the change can break, XML out of order and files that came from the org. 🔴 fix before
  the commit, 🟡 attention. The Code Analyzer runs once for security and quality.
- `reldor help` and the README show the moments (what now, understand, review, clean, merge, go up, undo); the
  detailed commands are listed as the pieces behind them.

## 0.10.0

- `reldor merge <branch>`: assisted merge into the merge branch. `git merge --no-ff --no-commit`, then every
  conflict is resolved with the rule "keep the target, apply only our change": changes next to each other both go
  in, insertions at the same spot keep both, removals leave the target, metadata XML is joined item by item. Only
  the same lines changed on both sides are left for review (or for the AI).
- "Did only yours go in?": `reldor merge --check` compares, line by line, what changed in the merge branch with what
  your branch changed, and points out lines that are not yours, target lines that disappeared, missing lines,
  leftover markers and other people's commits. `--continue` commits the merge after the check; `--abort` undoes it.
- XML and LWC HTML merged line by line must stay well formed; otherwise another alignment is tried and, if it still
  breaks, the file is left for review. Profile blocks that plain Git glues together come out whole.
- When something that is not yours is coming in (lines or other people's commits), the check says so first.
- `reldor clean`: before any tool commits, leaves only your work in the folder; what came from the org goes to a
  stash (`--undo` brings it back).
- Removed from the warnings: conflicts (the assisted merge resolves them) and the collision radar (now hidden).

## 0.9.0

- `reldor status` warns by itself: when the branch is not in the next environment yet, it runs a quick promotion
  rehearsal and the collision radar and shows only the real problems (missing dependencies, commit order, hard
  conflicts, colleagues changing the same lines). Cached per commit for 30 minutes; `--quick` skips it.
- `reldor collisions` is quiet by default: only work that is moving forward counts (an open pull request, read with
  `gh`, or a branch already in an environment). Merge branches are read through their PR. `--all` shows everything.
- The quick rehearsal also works on Git older than 2.38 (dependencies without the in-memory merge).

## 0.8.0

- Git actions are **off by default** (`git.actions: off`): Reldor checks and advises; branches, commits, merges and
  PRs stay with the team's own tool (e.g. the team's workflow plugin). `reldor init` asks. `reldor commit --stage` leaves only your
  lines in the stage without committing. `promote` and `rollback` show the steps as reference.
- `reldor collisions`: other open branches (last 30 days) that change the same files as yours, with the risk:
  same lines (high), same file (medium), metadata the smart merge joins (low). Shows author, date and environments.
- `reldor rollback <PR | commit | branch>`: rollback plan without changing anything. What goes back with the revert,
  what the PR created and must be deleted (ready `destructiveChanges.xml`), items to delete that are still used,
  files changed again after the PR, notes per type, and the steps in the team's flow (revert the feature's commits
  in a rollback branch and promote it like a feature).
- Windows: Git now runs without cmd.exe, so revisions like `abc^2` and paths with spaces are passed as they are.

## 0.7.0

- `reldor promote <environment>`: promotion rehearsal, without changing anything. Lists the commits that go along,
  commits that have not gone through the previous environment (the pipeline would block them), other people's
  commits (develop merged or pulled into the branch), conflicts (metadata XML tried item by item) and fields,
  objects and classes that will not exist in the environment after the merge, with where they do exist.
- `reldor merge install | uninstall | status`: smart merge driver for profiles, permission sets, labels,
  translations, sharing rules, value sets and package.xml, inside the normal `git merge`. Only the item both sides
  changed differently becomes a conflict. Also turns on `rerere`. Local only (`.git/info/attributes`).
- Simulates the merge with `git merge-tree` (Git 2.38+) or a temporary worktree on older Git.

## 0.6.0

- `reldor quality`: reports the repetition a change creates, and only that: blocks copied from elsewhere in the
  project (CPD-style, literals ignored), SOQL that already exists in another class, queries outside the fflib
  Selector, methods that already exist (same signature and similar body) or are 80% similar, and texts repeated in
  three or more classes (Custom Label candidates). `--all` reviews the whole project.
- Runs the Code Analyzer `Recommended` (PMD) and `cpd` rules too, when installed. `--fail-on` for scripts.
- Classes that share a contract (two Selectors, the same interface or base class) are not reported as copies.
- Calibrated on public Salesforce projects (fflib samples, apex-recipes, ebikes, dreamhouse, coral-cloud).

## 0.5.0

- `reldor security`: security review of the changed files (or `--all`): SOQL injection (values from outside the
  method concatenated into dynamic queries), CRUD/FLS on exposed methods, sharing on entry points, sensitive data in
  `System.debug`, secrets and fixed or plain-http endpoints, weak hashes, fixed record IDs, LWC and Visualforce XSS,
  flows in system mode without sharing, guest profiles with too much access.
- Path findings: an exposed method that reaches, through the call chain, a `without sharing` class that reads or
  writes data.
- Runs the Salesforce Code Analyzer security rules too, when installed. `// reldor-ignore: <rule>` silences a finding.
- Calibrated on public Salesforce projects to cut false positives.

## 0.4.0

- `reldor retrieve`: confirms the org, warns about uncommitted work, and takes a snapshot after a broad retrieve
  (a retrieve of specific metadata counts as yours).
- `reldor commit`: clean commit. Takes only what changed after the snapshot, line by line, also in files the retrieve
  changed; files only the org changed stay out; `--include` takes a whole org file; `--dry-run` shows the plan.
- `reldor snapshot`: the snapshot for retrieves made outside Reldor.
- `reldor xml`: sorts and removes duplicates in profiles, permission sets, labels, translations, sharing rules,
  value sets, object translations and package.xml, touching only what it must; reports conflicting duplicates.
- `reldor hook install`: pre-commit guard for every commit, including by hand: blocks duplicated XML and files that
  only came from the org. Keeps an existing hook.
- Validated on public Salesforce projects.

## 0.3.0

- `reldor refine`: the facts behind a task idea. Finds the objects and fields in free text (API names, labels,
  picklist values, common Portuguese and English words), and returns automations, screens, roll-up cascade, bypass,
  tests, attention points, open questions and a size signal.
- New advisor `task-refine`: writes the task (what changes, impact, open questions, acceptance criteria, test
  scenarios, size) from those facts.

## 0.2.0

- `reldor test-radar`: tests that can break with your changes, with reason and priority (objects, classes, permissions,
  custom metadata, factories). `--run` validates your changed files in a sandbox without saving (`--dry-run` with
  `RunSpecifiedTests`), confirms the org and refuses production; reports failures and coverage of changed classes.
- `reldor check`: fields read outside the SOQL or selector.
- Fixed: the first file of `git status` lost its first letter.
- DML like `insert new Account(...)` is now recognized.

## 0.1.1

Validated against public Salesforce projects (fflib sample code, apex-recipes, dreamhouse, ebikes, coral cloud).

- `explain` follows only the methods of each phase (fflib and TriggerHandler-style), including private helpers.
- `explain` follows metadata-driven triggers: handler classes listed in custom metadata records.
- Chain depth 3; framework base classes are left out; a trigger named like a class no longer hides it.
- Related tests split into "use this chain" and "create or change the object".
- `usages` finds fields and classes in layouts, list views, compact layouts, permission sets, profiles, custom metadata
  records and flow record assignments.

## 0.1.0

- `reldor index`: incremental index of objects, fields, validation rules, record types, triggers, Apex, flows,
  workflow rules and LWC.
- `reldor explain`: automations in the order of execution, following the fflib chain, with cascade, async work,
  bypass switches and related tests.
- `reldor usages`: where a field, class, method, flow or object is used, with certainty.
- Advisors: `spec-review`, `automation-design`, `lwc-ux`.
- Skills answer in the conversation's language, short and didactic.
- README and docs in English and Portuguese. Claude Code plugin installable from the repository.

## 0.0.1

- `reldor init`, `reldor status`, `reldor log`. Kiro and Claude Code plugins built from the same skills.
