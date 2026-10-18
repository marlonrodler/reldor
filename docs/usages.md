<p align="center"><strong>English</strong> · <a href="./usages.pt-BR.md">Português</a></p>

# usages

## What it does

`usages` lists every place something is used: a field (`Account.CPF__c` or just `CPF__c`), a class, a method (`AccountsService.calcularScore`), a flow or an object. It looks in Apex, selectors, triggers, flows, validation rules, formulas, roll-ups, workflow field updates and LWC imports.

Every hit has a certainty. **Certain**: the name is used directly. **Likely**: the code uses the class or its fflib interface and calls a method with that name. **Possible**: the name only appears inside a text string, such as `Type.forName('...')`, so a search by name would miss it.

## When to reach for it

Ask "where is this used?" or "I'm going to delete X", or run `reldor usages <item>`. Reach for it before deleting or renaming anything, before changing a field's type, and during a rollback.

To see what runs when a record is saved, use [explain](./explain.md) instead.

## It's working if

- Your deploys stop failing with "referenced by" errors after a delete.
- "Likely" and "possible" hits make you look twice, and sometimes they matter.

## Common questions

**Why "likely" instead of "certain" for methods?**
Calls through a variable (`service.calcularScore()`) don't say the class name. Reldor links them through the variable's interface and the `Application` factory, which is strong evidence, not proof.

**Does it cover layouts and permissions?**
Yes: page layouts, list views, compact layouts, and field or class access in permission sets and profiles. Custom metadata records that name a class count too. For custom fields, a second pass reads the rest of the project: any metadata that names `Object.Field` (reports, report types, dashboards, field sets, quick actions, Lightning pages, prompt templates) is **certain**; LWC, Aura and Visualforce that use the field by name are **likely**; Apex that has the field name only inside a string (dynamic SOQL) is **possible**.

**What does it leave out?**
Jest tests (`__tests__`) and fields with the same name on another object when the code does not say which object.

## Where it fits

`usages` powers safe delete today, and the rollback plan and query checks in Phase 2.
