<p align="center"><a href="./usages.md">Português</a> · <strong>English</strong></p>

# usages

## What it does

`usages` lists every place something is used: a field (`Account.CPF__c` or just `CPF__c`), a class, a method (`AccountsService.calcularScore`), a flow or an object. It looks in Apex, selectors, triggers, flows, validation rules, formulas, roll-ups, workflow field updates and LWC imports.

Every hit has a certainty. **Certain**: the name is used directly. **Likely**: the code uses the class or its fflib interface and calls a method with that name. **Possible**: the name only appears inside a text string, such as `Type.forName('...')`, so a search by name would miss it.

## When to reach for it

Ask "where is this used?" or "I'm going to delete X", or run `reldor usages <item>`. Reach for it before deleting or renaming anything, before changing a field's type, and during a rollback.

To see what runs when a record is saved, use [explain](./explain.en.md) instead.

## It's working if

- Your deploys stop failing with "referenced by" errors after a delete.
- "Likely" and "possible" hits make you look twice, and sometimes they matter.

## Common questions

**Does a field with the same name on several objects (`Status__c`, `Contact__c`) get mixed up?**
No. Every use is tied to the object that owns the field by what the code says: the variable's type (`List<Account> accounts`), the query's `FROM` (subqueries and semi-joins too), `new Account(...)`, a `Parent__r.Field__c` path, a method's return type, a data class property, the flow element or `$Record`, the screen's form or imports, the report column, the layout's related list. Uses on other objects are listed apart under "Fora da lista", so nothing disappears silently.

**And when the code does not say the object?**
That happens with a field name in a string handed to dynamic code, such as `'Status__c'` in a field list or `prefix + 'Role__c'`. The hit is then **possible**, with the line, the reason and the objects that have a field with that name. When only one object in the project has that field, it is certain.

**And a field used dynamically (an engine that receives the field name)?**
`usages` takes the second look a developer would, in the "Campos dinâmicos" section:
- it finds the objects that **keep field names** (custom metadata, custom settings and objects with fields such as `Field__c`, `Field_API_Name__c`, `Source_Field__c`, or a relationship to FieldDefinition) and the classes that **use that name** to reach the field (`record.get(name)`, `fields.getMap()`, `Database.query(text)`);
- **custom metadata**: the records are in the project, so it checks them and says which records name the field;
- **custom settings and objects**: the records live in the org and Reldor does not read data; it says "check for records" and hands over the SOQL to run;
- **text in code** (a JSON built in an LWC, a field list in Apex): it shows the file and line, because these break at run time, not at compile time.

**Does it cover layouts, permissions and other metadata?**
Yes: layouts (related lists included), list views, compact layouts, record types, permission sets and profiles, reports, report types, dashboards, quick actions, Lightning pages, field sets, sharing sets, rules, apps, custom metadata records, Apex, triggers, flows, LWC, Aura and Visualforce.

**What does it leave out?**
Jest tests (`__tests__`), comments and sentences (error and assert messages that only mention the field).

## Where it fits

`usages` is the basis of safe deletion: run it before deleting or renaming. The [rollback plan](./rollback.en.md) does a similar check for the items it would delete.
