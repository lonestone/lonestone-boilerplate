---
id: v1.5.0/worktree-commands
domain: tooling
classification: migration
---

# Create and remove git worktrees with their own Docker project name and ports

## Goal

`pnpm worktree:create <name>` makes a worktree with its own `COMPOSE_PROJECT_NAME` and free ports, `pnpm worktree:remove <name>` stops only that worktree's Docker stack before it removes the worktree, and `AGENTS.md` tells agents to use them.

## Why

Two worktrees of one repo got the same Docker Compose project name, because Compose takes it from the folder name by default and the fixed `container_name` entries made it worse. A `docker compose down` in a worktree of another project deleted the database of the main checkout. The worktrees also fought for the ports written in `.env` (database, API, mail, storage, and the two web dev servers), and a worktree without `pnpm install` let commits pass without the lefthook checks.

The two commands fix all three. Create copies the `.env` files of the main checkout (or the `.env.example` files), sets `COMPOSE_PROJECT_NAME=<repo>-<name>`, picks ports that are free on the machine and unused by other worktrees (web dev ports included), rewrites the local URLs that carry those ports (`TRUSTED_ORIGINS`, `VITE_API_URL`, `API_BASE_URL`), and runs `pnpm install`. Remove stops the stack by the exact project name read from the worktree `.env`, never by a pattern, leaves Docker alone when the name is missing, refuses to run when it equals the main checkout's, and stops when there are uncommitted changes or real unpushed work. A branch whose work is already in `origin/main` (every commit has a twin, or after a squash merge the files it touches are the same) counts as integrated. It keeps the branch and the Docker volumes.

One script with two subcommands was chosen over two scripts so both share the same rules for names and env files. Plain `git worktree add` was rejected: it cannot tell worktrees apart.

## Applies When

- The project tracks the `tooling` domain.
- The project uses git worktrees, or agents work in them.
- `scripts/worktree.ts` does not exist.

## Do Not Apply When

- The project has no `docker-compose.yml`, or does not use `.env` files for its ports.
- The project already has its own worktree tooling. Compare first, and ask a human.

## Observable Gaps

1. **The script** — signal: `scripts/worktree.ts` does not exist.
   Add it from the staged reference. Adapt `ENV_FILES` (the `.env` files of the project) and the port keys (`DEFAULT_PORTS`, `PORT_ALIASES`) to the ports in the project's `docker-compose.yml` and `.env.example`.
   Done when: `pnpm exec tsc -p scripts/tsconfig.json` passes and `pnpm worktree:create --help` prints the help.

2. **The package scripts** — signal: `package.json` has no `worktree:create` and `worktree:remove` scripts.
   Add `"worktree:create": "tsx ./scripts/worktree.ts create"` and `"worktree:remove": "tsx ./scripts/worktree.ts remove"`.
   Done when: `rg "worktree:create" package.json` matches.

3. **The web dev ports** — signal: `vite.config.ts` of a web app hard-codes `server.port`, or does not read `WEB_SPA_PORT` / `WEB_SSR_PORT` from the root `.env`.
   Read the port from the root `.env` with `loadEnv(..., '../..', 'WEB_SPA_PORT')` and keep the literal `port: <number>` as the default (the init CLI rewrites it). Do not add the keys to `.env.example`: the script writes them in a worktree's root `.env`. Add the keys to `DEFAULT_PORTS` in the script.
   Done when: `rg "WEB_SPA_PORT|WEB_SSR_PORT" apps/*/vite.config.ts` matches.

4. **Worktrees are ignored by the tools** — signal: `.worktrees/` is missing from `.gitignore`, or from the ignore lists of oxlint, oxfmt and knip.
   Add it where it is missing.
   Done when: `rg "worktrees" .gitignore .oxlintrc.json .oxfmtrc.json knip.json` matches in each file.

5. **The agent rule** — signal: `AGENTS.md` does not mention `pnpm worktree:create`.
   Add the one line from the staged reference.
   Done when: `rg "worktree:create" AGENTS.md` matches.

## Out of Scope

- Deleting branches or Docker volumes.
- Existing worktrees: recreate them with the new command.

## Reference Paths

- `scripts/worktree.ts` — **copy**
- `package.json` — **adapt**
- `apps/web-spa/vite.config.ts` — **adapt**
- `apps/web-ssr/vite.config.ts` — **adapt**
- `AGENTS.md` — **adapt**

## Validation

- `pnpm worktree:create tryout` makes `.worktrees/tryout` with a `COMPOSE_PROJECT_NAME` and ports that differ from the main checkout's.
- `pnpm docker:up` in that worktree starts a stack that does not touch the main checkout's containers.
- `pnpm worktree:remove tryout` stops that stack only and removes the worktree, and it refuses when the worktree has uncommitted changes.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/worktree-commands --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
