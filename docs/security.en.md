<p align="center"><a href="./security.md">Português</a> · <strong>English</strong></p>

# security

## What it does

`security` reviews the files your feature changed (or the whole project with `--all`) and lists security problems by priority, each with the file, the line and how to fix it. It combines Reldor's own rules with the security rules of the official **Salesforce Code Analyzer**, when it is installed (`sf plugins install code-analyzer`).

| Risk | What it looks for |
|---|---|
| SOQL injection | A dynamic query that concatenates a value coming from outside the method, without binds or `escapeSingleQuotes` |
| CRUD/FLS | Methods called from screens, APIs or flows that read or write without `USER_MODE`, `as user` or `stripInaccessible` |
| Sharing | Entry-point classes without a sharing declaration, or `without sharing` |
| Sensitive data in logs | `System.debug` with CPF, account, balance, token... (the list is configurable) |
| Secrets and endpoints | Tokens or passwords in the code, endpoints outside Named Credentials, `http://` callouts |
| Weak crypto | MD5 and SHA1 |
| Fixed IDs | Record IDs written in the code |
| LWC and Visualforce | `innerHTML`, `eval`, `lwc:dom="manual"`, `escape="false"`, merge fields in scripts without `JSENCODE` |
| Flows | Flows running in system mode without sharing, worse when they are screens |
| Guest access | Guest user profiles that can edit, delete or see all records |

It also follows the **path**: a method called from outside that reaches, through the call chain, a `without sharing` class that reads or writes data. A file-by-file scanner does not see this, because each file looks fine on its own.

## When to reach for it

The AI runs it before committing Apex, LWC, Visualforce, flows or profiles. Say "is there any security problem?" or run `reldor security`. `--fail-on alta` makes it return an error when there is a high-priority finding, for scripts.

## It's working if

- High findings are fixed before the pull request, not found later by someone else.
- Logs stop carrying customer data.

## Common questions

**A finding is intentional.**
Add `// reldor-ignore: <rule>` on the line or the line above, with a comment saying why. For CRUD, `@SuppressWarnings('PMD.ApexCRUDViolation')` is respected too.

**Does it replace a pentest or the security team?**
No. It catches the common mistakes early, while the code is still on your machine.

**The pipeline already runs the Code Analyzer.**
Save `code-analyzer: skip` in [`tools`](./tools.en.md): `security` runs only Reldor's rules and says the Code Analyzer stays with the pipeline (`--analyzer` runs it anyway). Reldor's rules do not run twice over the same content: if `review` already checked those files, the result is reused. The Code Analyzer also keeps its result per rule set and content.

## Where it fits

Before [commit](./commit.en.md), next to [test-radar](./test-radar.en.md). It uses the same index as [explain](./explain.en.md) to follow the path.
