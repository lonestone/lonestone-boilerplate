---
id: v1.4.0/ui-base-ui-finish
domain: frontend
classification: migration
---

# Finish The Move Of The UI Package To Base UI

## Goal

`packages/ui` depends on no `@radix-ui/*` package, its components compose through Base UI's `render` prop instead of `asChild`, and the agent guidance names Base UI.

## Why

shadcn now ships its components on Base UI, and Radix is no longer actively maintained. The `ui` package had already moved to shadcn's `base-nova` style, but two Radix packages were left: `@radix-ui/react-slot` in `form.tsx` and `file-upload.tsx`, and `@radix-ui/react-label` for one type in `form.tsx`. While they stay, agents see Radix in the code and in `AGENTS.md`, and they write `asChild` and Radix imports back into new code. Removing the last uses and naming Base UI in the guidance gives them one way to compose components.

`FormControl` now takes its control through `render`, like every Base UI part: `<FormControl render={<Input {...field} />} />`. It has no `children` prop any more, so the old form fails to type-check instead of rendering a wrapper `div` that would carry the control's id. shadcn's `base-nova` style has no `form` component (it moved to `Field`). We kept our `form.tsx` rather than rewriting every form on `Field`: the change stays small and the forms keep their shape. The file-upload parts swap `asChild` for `render` too, except `FileUploadItemPreview`, whose `render` prop already draws the file preview and keeps that meaning.

## Applies When

- `packages/ui/package.json` lists `@radix-ui/react-slot` or `@radix-ui/react-label`.
- Or a file under `packages/` or `apps/` imports from `@radix-ui/`, or passes `asChild`.
- Or `AGENTS.md`, `CLAUDE.md` or `.cursor/rules/0_common.mdc` names "Radix UI" in its intro.

## Do Not Apply When

- The project has removed `packages/ui` or replaced it with another component library.
- A human decided, after review, to keep Radix in this project.

## Observable Gaps

1. **`FormControl` callers** — signal: `<FormControl>` used with children, in any `.tsx` under `apps/` or `packages/`. Compare with the staged reference `apps/web-spa/app/features/auth/forms/auth-login-form.tsx`.
   Done when: every call reads `<FormControl render={<Control … />} />`, and the control keeps its own props (`id`, `{...field}`, and so on).
2. **`form.tsx`** — signal: `@radix-ui/react-slot` or `@radix-ui/react-label` imported in `packages/ui/src/components/primitives/form.tsx`. Compare with the staged reference.
   Done when: `FormControl` uses `useRender` from `@base-ui/react/use-render`, and `FormLabel` takes `React.ComponentProps<typeof Label>`.
3. **`file-upload.tsx`** — signal: `asChild` or `Slot` in `packages/ui/src/components/primitives/file-upload.tsx`. Compare with the staged reference.
   Done when: the parts take `render` and render through the local `Primitive` helper, and any caller that passed `asChild` passes `render={<Element />}` instead.
4. **Dependencies** — signal: `@radix-ui/react-slot` or `@radix-ui/react-label` in `packages/ui/package.json`.
   Done when: both are gone and `pnpm install` updated the lockfile. Radix packages that remain only as dependencies of `cmdk` are expected.
5. **Agent guidance** — signal: "Radix UI" in the intro of `AGENTS.md`, `CLAUDE.md` or `.cursor/rules/0_common.mdc`, or no Base UI bullet in `apps/documentation/src/content/docs/references/frontend.mdx`.
   Done when: the intros name Base UI, and the frontend guidelines carry the Base UI bullets of the staged reference.

## Out of Scope

- Other `ui` components the project added or changed itself, unless they import Radix or use `asChild`.
- Rewriting forms on shadcn's `Field` component.
- `cmdk` and the Radix packages it pulls in.
- The project's own wording in `AGENTS.md` beyond the intro line.

## Reference Paths

- `packages/ui/src/components/primitives/form.tsx` — **adapt**
- `packages/ui/src/components/primitives/file-upload.tsx` — **adapt**
- `packages/ui/package.json` — **adapt**
- `apps/web-spa/app/features/auth/forms/auth-login-form.tsx` — **adapt**
- `apps/documentation/src/content/docs/references/frontend.mdx` — **adapt**
- `AGENTS.md` — **adapt**

## Validation

- `grep -rn "@radix-ui/\|asChild" apps packages --include='*.ts' --include='*.tsx' --exclude-dir=node_modules` prints nothing.
- `pnpm lint` passes.
- `pnpm typecheck` passes, and `pnpm --dir packages/ui exec tsc --noEmit` passes.
- The project's forms still show their errors under the field, and clicking a label focuses its field.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/ui-base-ui-finish --applied` after validation passes, or record it as skipped with a reason.
