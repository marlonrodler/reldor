<p align="center"><strong>English</strong> · <a href="./lwc-ux.pt-BR.md">Português</a></p>

# lwc-ux

## What it does

`lwc-ux` stops before a Lightning Web Component is written and proposes two or three screen options, from the simplest to the most modern, with pros and cons. It checks for existing components to reuse and offers a throwaway visual POC in `.reldor/work/<task>/poc/`, outside `force-app`, so nothing reaches the repository before you choose.

Every option follows a quality checklist: base components and SLDS, Lightning Data Service when Apex is not needed, cached reads, loading, empty and error states, accessibility, mobile, and pagination for long lists. SLDS is the default; if the project has no `design_system` set, it asks once and records the answer.

## When to reach for it

The AI reaches for it when someone is about to create or change an LWC. You can ask "how should this screen look?".

## It's working if

- You see options before code.
- Screens stop shipping without loading and error states.

## Where it fits

It is the screen counterpart of [automation-design](./automation-design.md).
