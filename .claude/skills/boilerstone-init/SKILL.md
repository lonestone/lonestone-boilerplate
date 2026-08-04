---
name: boilerstone-init
description: Onboard an existing project into the Lonestone boilerplate upgrade system — fetch .boilerstone, determine the source version, initialize tracking. Use when the user asks to "onboard a project", "init boilerstone", "brancher un projet au boilerplate", or wants to start tracking boilerplate upgrades on a project that predates the system.
---

# Boilerstone init

This skill is a thin adapter. The canonical procedure is the "Onboarding a project" section of `.boilerstone/README.md` (and the `v1.0.0/setup-boilerplate-tracking` intention) — read it first and follow it exactly.

## Preflight

1. If the target project already has `.boilerstone/boilerplate.json`, it is already onboarded — point the user to `boilerstone-upgrade` and stop.
2. Never run `pnpm rock` on an existing project — it renames packages and rewrites env/docker; it is safe only on a fresh template.

## Procedure

```bash
# At the root of the project to onboard (BOILERPLATE_REPO=<url> for a fork/private mirror)
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- onboard
```

The installer fetches `.boilerstone/` and the `boilerstone-upgrade` skills, runs `bootstrap`, then offers to commit (`[Y/n]`).

## Your real job: the source version answer

Bootstrap asks for the source boilerplate version. This is the one dangerous answer of the whole flow — intentions tagged with the source version itself are never replayed, so answering too high silently skips work forever.

- Inspect the project (dependency versions, config patterns) against the boilerplate releases to recommend an answer.
- When the project predates the upgrade system or you are unsure, answer `0.0.0` so every intention stays applicable.

## Verify

```bash
pnpm boilerplate upgrade status
```

State plus readiness checks must pass before any `upgrade prepare`.
