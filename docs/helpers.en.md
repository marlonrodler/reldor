<p align="center"><a href="./helpers.md">Português</a> · <strong>English</strong></p>

# helpers and me

## What it does

**`reldor helpers <term>`** shows the public methods that **already exist** for that, before you (or the AI) write another one. It searches the words in the method name, the class name and the parameters, and shows **shared code** first (classes without a team prefix, like `StringUtils` or a Selector), then what is in team classes, with the signature and file:line.

**`reldor helpers --similar`** shows methods with the same name in **different teams**: two teams wrote the same thing. Each group is a candidate to become one generic method in a shared class. Methods that repeat on purpose (same base class or same interface) are left out.

**`reldor me --team <name> --prefix <PREFIX>`** saves your team **only on your machine** (`.reldor/local.yaml`, which is in `.gitignore`). Nobody else on the team needs to set anything up. With the prefix, it shows what belongs to your team in the project (classes, objects, fields) and examples of the pattern. Without arguments, it shows the prefixes found in the project, so you can pick.

The team is found by the **name prefix** (`VND_PedidoService`, `VND_Pedido__c`, `VND_Valor__c`). A team prefix is one written in capitals on at least 3 items; what has no prefix is shared. Everything comes from the project index: no org, no AI, under a second after the first index.

## When to reach for it

The AI uses it by itself before creating a method: "I need a method that formats a tax ID" → `reldor helpers format taxid`. If it already exists in shared code, it uses that. If it only exists in another team's class, it suggests moving it to shared code instead of copying. If it doesn't exist and another area may need it, it suggests a **generic** method: what changes becomes a parameter (the object, the field, the Ids, the options), in a shared class.

In the terminal: `reldor helpers format`, `reldor helpers --similar`, `reldor me`, `reldor me --team sales --prefix SLS`.

## It's working if

- Teams stop creating the same method each with their own prefix.
- Someone new on a team finds the helper that already exists instead of writing another.

## Common questions

**Our team doesn't use a prefix.**
Then everything shows up as shared, and `helpers` still finds the methods that already exist. `me --prefix` accepts any prefix you give, even if it shows up only a few times.

**Why doesn't my team go into profile.md?**
Because `profile.md` belongs to the whole team, and each person is on one team. Yours stays in `.reldor/local.yaml`, out of Git.

## Where it fits

During development, before writing new code. The patterns the AI follows are in [`profile.md`](./init.en.md#profilemd); copying that slips through shows up in [`quality`](./quality.en.md).
