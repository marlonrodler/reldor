<p align="center"><a href="./check.md">Português</a> · <strong>English</strong></p>

# check

## What it does

`check` runs the query check on the whole project, or on the classes you name: custom fields read from records that the class queried, but missing from its SOQL or from the selector it uses. Each finding is **likely**, or **possible** when the class also builds queries at runtime (`Database.query`).

Classes that receive records as parameters or from `Trigger.new` are skipped, because their fields cannot be judged from the code.

## When to reach for it

Run `reldor check` once on a project to find old problems, or `reldor check MyClass` while you work. `test-radar` already runs it on the classes you changed.

## Common questions

**The same as review does?**
Yes: `review` already includes this check. With the same content and the same classes, the result is reused, so running both does not repeat the work.

## Where it fits

It is the static half of [test-radar](./test-radar.en.md).
