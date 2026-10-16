# Changelog

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
