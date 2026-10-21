<p align="center"><a href="./access.md">Português</a> · <strong>English</strong></p>

# access

## What it does

Often a task asks to "create" something that **already exists, but is not enabled**: the picklist value is there, but not in the task's record type; the field exists, but not on the layout or in the permission set. `reldor access` answers "it exists, but is it enabled?" and shows **where it still has to be enabled**, with the file, so nobody has to hunt for it.

For a field (`reldor access Object.Field`), and optionally a picklist value (`--value "Value"`), it checks:

- **the value**: does it exist in the field or the global value set? Is it active? If not, it shows similar values that already exist (a typo, another name);
- **dependent picklist**: is the value enabled for any value of the controlling field?
- **record types**: each record type lists values one by one; it says which ones lack the value (and, for `StageName`, the business processes);
- **field access (FLS)**: which profiles and permission sets give edit, read only or nothing;
- **layouts**: which layout each record type uses (per profile) and whether the field is on it; and the record pages (FlexiPage) where it shows up;
- **path, translations** and **rules or code that name the other values** (a validation rule with `ISPICKVAL` for each stage, a flow, Apex, a screen config) but not this one: they may need the new value too.

For an object (`reldor access Object`): object permissions and record type visibility. For an Apex class (`reldor access MyClass`): which profiles and permission sets enable it.

It reads the project's XML directly: fast, and no org needed.

## When to reach for it

When the task talks about a value, a field or a screen that "doesn't show up". The AI uses it by itself during refinement: for each value in the task, it runs `access` and puts what has to be enabled into the task. In the terminal: `reldor access Opportunity.Status__c --value "Approved" --rt Retail --perms Sales`. With `--rt` and `--perms`, it checks only the task's record types and access.

## It's working if

- Nobody creates a value that already existed.
- "I deployed and it doesn't show up" goes away: what had to be enabled was already in the task.

## Common questions

**It says no profile gives access, but the org has one.**
It sees what is in the project. If the retrieve didn't bring the task's profiles, permission sets or record types, bring them before concluding.

**Why does the record type need the value?**
In Salesforce, each record type picks which values of each picklist show up. A new value does not go into existing record types by itself.

## Where it fits

During refinement ([refine](./refine.en.md)) and before [deploy](./deploy.en.md): what has to be enabled becomes part of the change.
