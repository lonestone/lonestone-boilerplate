---
id: unreleased/one-source-agent-instructions
domain: docker-env
classification: migration
---

# Drop fixed container names and make `CLAUDE.md` point to `AGENTS.md`

## Goal

`docker-compose.yml` has no fixed `container_name`, and `CLAUDE.md` holds only the line `@AGENTS.md`.

## Why

Two things were written twice or shared by accident.

A fixed `container_name` is the same in every checkout. Two worktrees of one repository then shared their containers. A `docker compose down` in one worktree of another project removed the database of the main checkout. Without a fixed name, Compose prefixes the container with the project name, so each checkout gets its own containers.

`CLAUDE.md` was a full copy of `AGENTS.md`. Every change had to be made twice. Claude Code reads `@AGENTS.md` as an import, so one line is enough and the text lives in one place.

## Applies When

- The project tracks the `docker-env` domain.
- `docker-compose.yml` has at least one `container_name` line.
- Or `CLAUDE.md` exists and is not just `@AGENTS.md`.

## Do Not Apply When

- A human has decided to keep a fixed container name, for example because an external tool looks the container up by that name.
- `CLAUDE.md` has project-specific content that `AGENTS.md` does not have, and a human has decided to keep it separate.

## Observable Gaps

1. **Fixed container names** — signal: `rg container_name docker-compose.yml` finds a match.
   Remove each `container_name` line. Then replace every reference to the old name in docs and scripts with the service name, for example `docker compose exec maildev …`.
   Done when: `rg container_name docker-compose.yml` finds nothing and `docker compose config` is valid.

2. **`CLAUDE.md` copy** — signal: `CLAUDE.md` has more than the line `@AGENTS.md`.
   If it differs from `AGENTS.md`, move the lines that only live in `CLAUDE.md` into `AGENTS.md` first. Then replace the content of `CLAUDE.md` with the single line `@AGENTS.md`.
   Done when: `CLAUDE.md` contains only `@AGENTS.md`.

## Out of Scope

- Service names, images, ports and volumes in `docker-compose.yml`.
- The content of `AGENTS.md`, except lines moved in from a diverging `CLAUDE.md`.
- Editor rules such as `.cursor/rules`.

## Reference Paths

- `docker-compose.yml` — **adapt**
- `CLAUDE.md` — **copy**

## Validation

- `docker compose config` is valid.
- `docker compose ps` in two worktrees of the same project lists different containers.
- Claude Code in the project still loads the rules from `AGENTS.md`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/one-source-agent-instructions --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
