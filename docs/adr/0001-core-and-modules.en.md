<p align="center"><a href="./0001-core-and-modules.md">Português</a> · <strong>English</strong></p>

# 0001 · Core plus modules

Reldor is split into a generic core and one module per technology. The core only calls a small contract
(`matches`, `detect`, `statusLines`, `profileLines`) so new technologies plug in without changing it. Salesforce is the
first module.
