---
id: unreleased/writing-rules
domain: tooling
classification: migration
---

# Adopt the documentation and cognitive load rules

## Goal

The project's documentation guidelines say that documentation explains how things work. They say it does not retell the code. The general guidelines carry a short cognitive load rule.

## Why

Documentation that copies the code goes stale and is costly to maintain. Code that is hard to hold in the head slows every new teammate. These two rules give people and agents a shared standard to apply in reviews.

## Applies When

- The project has `apps/documentation/src/content/docs/references/0_documentation.mdx` and `general.mdx`.

## Do Not Apply When

- A human decided to keep the project's own documentation and code standards.

## Observable Gaps

1. **Documentation rule missing** — signal: no `## What to write` section in `references/0_documentation.mdx`.
   Adapt the `What to write` section from the staged `references/0_documentation.mdx`.
   Done when: `grep -n '## What to write' apps/documentation/src/content/docs/references/0_documentation.mdx` finds it.
2. **Cognitive load rule missing** — signal: no `## Cognitive load` section in `references/general.mdx`.
   Adapt the `Cognitive load` section from the staged `references/general.mdx`. Keep its link to the design philosophy page pointing at the project's own page.
   Done when: `grep -n '## Cognitive load' apps/documentation/src/content/docs/references/general.mdx` finds it.
3. **Reasons missing** — signal: no `Keeping the cognitive load low` section in `explanations/0_designphilosophy.mdx`.
   Adapt the `Keeping the cognitive load low` section from the staged `explanations/0_designphilosophy.mdx`.
   Done when: `grep -n '## Keeping the cognitive load low' apps/documentation/src/content/docs/explanations/0_designphilosophy.mdx` finds it.

## Out of Scope

- The project's own coding standards and other documentation pages.

## Reference Paths

- `apps/documentation/src/content/docs/references/0_documentation.mdx` — **adapt**
- `apps/documentation/src/content/docs/references/general.mdx` — **adapt**
- `apps/documentation/src/content/docs/explanations/0_designphilosophy.mdx` — **adapt**

## Validation

- `pnpm fmt:check` passes, if the project has it.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/writing-rules --applied`
