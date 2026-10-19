<p align="center"><a href="./refine.md">Português</a> · <strong>English</strong></p>

# refine

## What it does

`refine` takes a task idea in plain words ("block closing an opportunity without an approved proposal") and returns the facts around it. It finds the objects and fields the idea mentions, by API name, label, picklist value or a common word in Portuguese or English (*conta*, *oportunidade*, *caso*...). For each object it lists triggers and their handler chain, active flows, validation rules, record types, legacy workflow rules, the roll-up cascade, screens (LWC), bypass switches and how many tests touch it. For each field: whether it exists, its type and where it is used.

From those facts only, it adds **attention points** (the object already has a trigger, so the logic goes into its handler), **open questions** (which record types? what about existing records? what volume?) and a **size signal** (small, medium or large, from the number of pieces involved; not an hour estimate).

The [task-refine](./advisors/task-refine.en.md) advisor turns this into the written task.

## When to reach for it

Say "I want to create a task to..." or "refine this task", or run `reldor refine "<idea>"`. Reach for it **before** the task goes to the board, especially when someone who does not code writes it.

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
