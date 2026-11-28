---
id: unreleased/one-source-per-agent-rule
domain: tooling
classification: migration
---

# Write each agent rule in one place

## Goal

A project rule for agents is written once, in a file under `apps/documentation/src/content/docs/references/`. `AGENTS.md` and the Cursor rule only point to it.

## Why

The same instructions lived in `AGENTS.md`, in four Cursor rules and in the README. Each one said "read the README, the index and the guidelines". A change had to be made in several places, and the copies drifted.

`AGENTS.md` now lists one pointer per subject and keeps a rule only if an agent forgets it without it. One Cursor rule, always applied, tells Cursor to read `AGENTS.md`. The README says that personal rules stay out of the repo and that project rules live in `references/`.

## Applies When

- The project has an `AGENTS.md` or a `.cursor/rules/` folder.
- `AGENTS.md` has no list that points to the files of `references/`.
- Or `.cursor/rules/` has more than one rule that only says "read this file".

## Do Not Apply When

- The team chose to keep tool-specific rules on purpose, for example Cursor rules that differ from `AGENTS.md`. Record as skipped with that reason.

## Observable Gaps

1. **Pointers in AGENTS.md** — signal: `AGENTS.md` has no line that names `references/backend.mdx`.
   Compare with the staged `AGENTS.md`. Add the pointer list. Keep every rule the project wrote itself, and move a project rule that repeats `references/` into `references/` instead of deleting it.
   Done when: `rg "references/backend.mdx" AGENTS.md` finds a line, and so for each `references/` file the project has.

2. **Cursor rules that only point** — signal: a file in `.cursor/rules/` holds only "read file X" (open each one; `wc -l .cursor/rules/*` shows the short ones).
   Replace the pointer rules with the staged `.cursor/rules/0_agents.mdc`. Keep any rule with its own content (package manager update, migrations, or the project's own).
   Done when: `wc -l .cursor/rules/*` shows no rule that only says "read file X", except `0_agents.mdc`.

3. **README sentence** — signal: the README section on AI agents says "Do not add rules to the repo".
   Replace it with the staged sentence: no personal rules in the repo, the project's rules live in `references/`, and `AGENTS.md` points to them. Keep the project's own exceptions, such as skills.
   Done when: `rg "Do not add rules" README.md` returns nothing.

4. **Cursor wording in the guidelines** — signal: `rg -i "rules \(cursor\)|cursor rules" apps/documentation/src/content/docs/references README.md` matches.
   Reword the line so it names the docs and no tool. Done when: the same `rg` returns nothing.

## Out of Scope

- The content of the project's rules. Move and point; never change what a rule means.
- `CLAUDE.md`, handled by `v1.5.0/one-source-agent-instructions`.
- Skills under `.claude/skills/` and `.cursor/skills/`.

## Reference Paths

- `AGENTS.md` — **adapt**
- `.cursor/rules/0_agents.mdc` — **adapt**
- `README.md` — **adapt**
- `apps/documentation/src/content/docs/references/general.mdx` — **adapt**

## Validation

- `pnpm fmt:check` passes.
- `rg -o "references/[^` ]+" AGENTS.md`names only files that exist under`apps/documentation/src/content/docs/references/`.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/one-source-per-agent-rule --applied` after validation passes, or record it as skipped with a reason.
