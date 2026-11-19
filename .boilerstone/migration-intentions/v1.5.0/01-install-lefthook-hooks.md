---
id: v1.5.0/install-lefthook-hooks
domain: tooling
classification: migration
---

# Install the lefthook git hooks on `pnpm install`

## Goal

`pnpm install` installs the lefthook git hooks, so the commit-msg and pre-push checks run on every clone without a manual step.

## Why

The project has `lefthook.yml` and `lefthook` as a dev dependency, but nothing installed the hooks. The `lefthook` package only fetches its binary on install. It does not write into `.git/hooks`. So the hooks never ran, and invalid commit messages, lint errors and type errors reached CI and failed pull requests. A root `prepare` script runs after every `pnpm install`, so no one has to remember a command.

The script runs `lefthook install` only when a `.git` entry exists. Docker image builds and other installs without a repository would fail on a bare `lefthook install`, and `LEFTHOOK=0` does not stop that command. A plain `|| true` was rejected because it hides real failures and prints a boxed error in every Docker build.

The guard alone is not enough when a Docker build uses the repository root as its context: `COPY . .` brings `.git` into the image, the guard passes, and `lefthook install` fails because the image has no `git`. The root `.dockerignore` keeps `.git` out of the context, so the guard skips.

## Applies When

- The project tracks the `tooling` domain.
- `lefthook.yml` exists and `lefthook` is in the root `package.json` dev dependencies.
- The root `package.json` has no script that runs `lefthook install`.

## Do Not Apply When

- The project has no `lefthook.yml` and has explicitly stayed off lefthook.
- A human has decided to install the hooks another way (for example `core.hooksPath` managed elsewhere) after reviewing this intention.

## Observable Gaps

1. **Prepare script** — signal: root `package.json` has no `prepare` script, or it does not run `lefthook install`.
   Add the `prepare` script from the staged reference `package.json`. If the project already has a `prepare` script, chain the lefthook command into it. Touch no other script.
   Done when: `rg '"prepare"' package.json` matches and the script runs `lefthook install` only when `.git` exists.

2. **Hooks installed locally** — signal: `.git/hooks/commit-msg` does not exist after a fresh install.
   Run `pnpm install` (or `pnpm run prepare`).
   Done when: `git commit --allow-empty -m "bad message"` is refused by commitlint.

3. **Docker build context** — signal: a Dockerfile builds from the repository root (for example `COPY . .`) and the root `.dockerignore` does not list `.git`.
   Add `.git` to the root `.dockerignore`, matching the staged reference. Use `**/node_modules` rather than `node_modules` there, so the apps' own `node_modules` stay out too.
   Done when: the root `.dockerignore` lists `.git`, and each Dockerfile that runs `pnpm install` builds.

4. **Contributing note** — signal: `CONTRIBUTING.md` does not say that `pnpm install` installs the hooks.
   Add that one sentence next to the lefthook sentence, matching the staged reference.
   Done when: `CONTRIBUTING.md` mentions that `pnpm install` installs the hooks.

## Out of Scope

- The hooks themselves (`lefthook.yml`) and the commitlint rules.
- CI workflows and the Dockerfiles themselves: the guard and the root `.dockerignore` keep them working unchanged.
- Existing team members: they run `pnpm install` once to get the hooks.

## Reference Paths

- `package.json` — **adapt**
- `CONTRIBUTING.md` — **adapt**
- `.dockerignore` — **adapt**

## Validation

- `pnpm install` completes, and `.git/hooks/commit-msg` and `.git/hooks/pre-push` exist.
- `git commit --allow-empty -m "bad message"` is refused.
- Every Docker image of the project still builds.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/install-lefthook-hooks --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
