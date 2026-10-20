<p align="center"><a href="./review.md">Português</a> · <strong>English</strong></p>

# review

## What it does

`review` is everything worth checking before a commit, in one run and one summary, for the files your branch changed:

| Part | What it looks for |
|---|---|
| [Security](./security.en.md) | SOQL injection, CRUD/FLS, sharing, sensitive data in logs, secrets, XSS, flows, guest access |
| [Quality](./quality.en.md) | Copied blocks, repeated queries, queries outside the Selector, methods that already exist, PMD |
| [Queries](./check.en.md) | Fields read but missing in the SOQL or Selector (an error in production) |
| [Tests](./test-radar.en.md) | The test classes your change can break |
| [XML](./xml.en.md) | Profiles, permission sets and labels out of order or with conflicting duplicates |
| [Org files](./clean.en.md) | Changes that came from the org in a retrieve and are not yours |

The summary has two groups: 🔴 **fix before the commit** and 🟡 **attention**, each item with the file, the line and how to fix it. Then the tests to run. The Salesforce Code Analyzer runs once for security and quality when installed; `--no-analyzer` skips it.

## When to reach for it

Say "can I commit?". The AI runs it and goes through the 🔴 items first.

## It's working if

- You stop running four checks by hand, or forgetting one.

## Common questions

**Do the separate commands still exist?**
Yes (`security`, `quality`, `check`, `test-radar`, `xml`), for when you want only one part. `review` is the one to use day to day.

**Another team tool already does some of these checks.**
`review` follows [`tools`](./tools.en.md): a part another tool does is only checked (`verify`) or left out (`skip`), and the summary lists both with the tool's name, so nothing disappears silently. With the same content, no check runs twice: running `review` again, or the hook right after, reuses the result (♻️). `--fresh` redoes everything.

## Where it fits

Right before [clean](./clean.en.md) and the commit.
