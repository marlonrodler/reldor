<p align="center"><a href="./refine.md">Português</a> · <strong>English</strong></p>

# refine

## What it does

`refine` takes a task idea in plain words ("block closing an opportunity without an approved proposal") and returns the facts around it. It finds the objects and fields the idea mentions, by API name, label, picklist value or a common word in Portuguese or English (*conta*, *oportunidade*, *caso*...). For each object it lists triggers and their handler chain, active flows, validation rules, record types, legacy workflow rules, the roll-up cascade, screens (LWC), bypass switches and how many tests touch it. For each field: whether it exists, its type and where it is used.

From those facts only, it adds **attention points** (the object already has a trigger, so the logic goes into its handler), **open questions** (which record types? what about existing records? what volume?) and a **size signal** (small, medium or large, from the number of pieces involved; not an hour estimate).

### In stages, without noise

With the task **in the standard** (an `alvos:` block at the top of the file, with the objects, fields, values and what the task asks to create), `refine` searches **only the targets**, never every word of the text:

1. **Names:** each target, as the task writes it ("Approval status", "Account"), becomes the API name, with how sure the match is: certain, likely, doubt (two candidates almost equal) or not found. Only a doubt becomes a question.
2. **Facts** of each object and field (the usual ones, above), and for each picklist value the [`access`](./access.en.md) command.
3. **Does it already exist? (`reuse`)**: for each item to **create** (field, object, class or method, flow, LWC), what the project already has with the same meaning, by label, name and description, in Portuguese and English. For each candidate: which team owns it (by prefix) or whether it is shared, how many uses and automations depend on it, and the suggestion:
   - **reuse** as it is, when it is shared or your team's and nothing of another team depends on it;
   - **create a generic one**, when it belongs to another team or another team's automations depend on it: don't touch theirs, create a shared one and offer it to them;
   - **create new**, when nothing is close.
   Renaming what exists is never suggested: in a big org it breaks reports, integrations and other teams' code.
4. **Limits:** if the new fields bring the object close to a limit, it says so (see [`limits`](./limits.en.md)).

Without the `alvos` block, it says the task is not in the standard and uses the words of the text, as before. The result is saved in the task's folder (`.reldor/work/tasks/<id>/refine.json`, see [`task`](./task.en.md)).

The [task-refine](./advisors/task-refine.en.md) advisor does the whole path: finds the task and the spec, puts the text in the standard, runs refine and access, and writes the task (or completes the existing spec) where you chose.

## When to reach for it

Say "I want to create a task to..." or "refine this task", or run `reldor refine "<idea>"`. Reach for it **before** the task goes to the board, especially when someone who does not code writes it.


With the AI, the path is different, to cut noise: it **saves the task text** to `.reldor/work/task.md` (long text on the command line breaks the terminal), **interprets first** which objects, fields and values the task asks for, and runs `reldor refine --file .reldor/work/task.md --objects Obj1,Obj2 --fields Obj.Field --values "Obj.Field=Value"`. With `--objects` or `--fields`, loose words in the text don't become objects: they show up only as "maybe". Each picklist value mentioned comes with the [`access`](./access.en.md) command, which shows whether the value already exists and where it still has to be enabled.

## It's working if

- Questions are answered in refinement, not in the middle of development.
- Tasks stop needing a second round because of an automation nobody mentioned.

## Common questions

**I write in Portuguese and the project's labels are in English. Does it work?**
Yes. It translates common business words ("entrega de serviço" → Service Delivery, "matrícula no programa" → Program Enrollment), understands plurals and reversed word order, and reads API names (`ServiceDelivery__c` → service delivery). The longer name wins: in "entrega de serviço" the object is Service Delivery, and Service shows only as "named inside another name". When only the last word appears ("o cronograma") and a single object ends that way, it uses it and asks you to confirm. The answer starts with "Entendi assim", the word that led to each object.

**What if a similar rule already exists?**
It says so: when an active validation rule or flow of the same objects talks about the same things as the request, "Já existe algo parecido" shows, so you can check whether the task is to adjust that rule instead of creating another one.


**It didn't find my object.**
Labels of standard objects in other languages are not in the repository. Pass them with `--objects Opportunity` or `--fields Opportunity.Stage__c`.

**Is the size an estimate?**
No. It counts the pieces the task touches. Use it to spot a "small" task that is actually large.

## Where it fits

It is the first step of the flow: refine → [explain](./explain.en.md) → develop → [test-radar](./test-radar.en.md).
