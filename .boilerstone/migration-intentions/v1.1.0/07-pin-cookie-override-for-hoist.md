---
id: v1.1.0/pin-cookie-override-for-hoist
domain: tooling
classification: migration
---

# Pin Cookie Override For Hoist

## Goal

Under a shamefully-hoisted pnpm layout, Express and Astro agree on `cookie@1.1.1`, and the documentation app stays on Astro 7.1.1.

## Why

The next boilerplate release found that cookie 1.x must stay on 1.1.1 so Express (`parse`/`serialize`) and Astro ≤7.1.1 (`parseCookie`) remain compatible when `shamefully-hoist=true`. Astro is pinned to 7.1.1 in the documentation app for the same reason. This is a two-line compatibility pin, not an unbounded dependency upgrade.

## Applies When

- The project tracks the `tooling` domain.
- `.npmrc` enables `shamefully-hoist` (or equivalent hoisting) **and** the workspace depends on both Express (API) and Astro (documentation app), or `pnpm install` fails on a `cookie` API mismatch.

## Do Not Apply When

- The project does not hoist dependencies (isolated `node_modules` / no `shamefully-hoist`) and does not use the documentation Astro app — the override is unnecessary.
- The project already pins `cookie` for a different, documented reason — stop and ask rather than overwrite that pin.
- The project has neither Express nor Astro.

## Observable Gaps

1. **Workspace override** — signal: `pnpm-workspace.yaml` has no `overrides.cookie: 1.1.1` (or an equivalent `.npmrc` / `package.json` override).
   Add the override from the staged reference, keeping any unrelated overrides the project already has.
   Done when: `pnpm install` resolves a single `cookie@1.1.1`.

2. **Astro pin** — signal: `apps/documentation/package.json` (or the project's docs app) lists `astro` as a caret range above 7.1.1, or `pnpm install` reports an Astro/`cookie` mismatch.
   Pin `astro` to `7.1.1` to match the staged reference. Do not bump `@astrojs/starlight` except as required for that Astro pin.
   Done when: the documentation app installs and `astro` is exactly 7.1.1.

## Out of Scope

- Catalog family version alignment — `unreleased/align-shared-dependency-versions`.
- Rewriting Express cookie usage or upgrading Astro past 7.1.1.
- Changing hoist settings in `.npmrc`.

## Reference Paths

- `pnpm-workspace.yaml` — **adapt**
- `apps/documentation/package.json` — **adapt**
- `.npmrc` — **adapt**

## Validation

- `pnpm install` completes without a `cookie` export/peer error.
- If the documentation app exists, `pnpm --filter=@boilerstone/documentation build` (or the project's equivalent) is not blocked by a `cookie` API mismatch.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/pin-cookie-override-for-hoist --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
