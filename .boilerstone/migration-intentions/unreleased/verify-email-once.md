---
id: unreleased/verify-email-once
domain: frontend
classification: migration
---

# Verify An Email Token Once

## Goal

The web-spa's verify-email page sends `authClient.verifyEmail` once per token, even when React's StrictMode runs its mount effect twice.

## Why

In development, StrictMode mounts the page twice, so the effect sent the same token twice. With the boilerplate's defaults this was harmless: the second call finds the email already verified. But a project that turns on Better Auth's `emailVerification.autoSignInAfterVerification` gets one session per call, so the visitor ends up with two sessions. A consumer project found this when its Playwright requests ran slower, and its registration scenario failed 6 runs out of 8. A ref that remembers the token already sent is the smallest guard. It keeps the page's behaviour. We rejected disabling StrictMode, which hides the symptom only in development, and deduplicating on the server, which Better Auth does not offer.

## Applies When

- File `apps/web-spa/app/features/auth/pages/auth-verify-email-page.tsx` exists.
- Its mount effect calls `authClient.verifyEmail`, directly or through a mutation, with no guard against a second run for the same token.

## Do Not Apply When

- The project has no web-spa app, or no verify-email page.
- The project verifies emails outside a React effect, for example in a route loader or on the server.

## Observable Gaps

1. **The guard** — signal: no `useRef` in `apps/web-spa/app/features/auth/pages/auth-verify-email-page.tsx`, or an effect that calls `verifyEmailMutation(token)` (or `authClient.verifyEmail`) unconditionally. Compare with the staged reference page.
   Done when: the effect sends the token only when the ref does not hold it yet, and sets the ref before it sends.
2. **One request per visit** — signal: in development, the browser's network panel shows two `verify-email` requests on one visit of `/verify-email?token=…`.
   Done when: one visit sends one request.

## Out of Scope

- The page's layout, texts, translations and redirects.
- Better Auth's configuration, including whether `autoSignInAfterVerification` is on.
- Other pages whose effects run twice under StrictMode.

## Reference Paths

- `apps/web-spa/app/features/auth/pages/auth-verify-email-page.tsx` — **adapt**

## Validation

- `pnpm --filter web-spa typecheck` passes.
- `pnpm lint` passes.
- In development, one visit of a verification link sends one `verify-email` request.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/verify-email-once --applied` (the id becomes `vX.Y.Z/verify-email-once` once released).
