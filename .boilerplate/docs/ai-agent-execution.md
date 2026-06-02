# AI Agent Execution Workflow

## Overview

This document describes how AI agents should execute boilerplate upgrades in consumer projects.

## Prerequisites

Before starting an upgrade session:

1. Ensure the project has a `.boilerplate/boilerplate.json` file (run `pnpm boilerplate upgrade init` if not)
2. Ensure the Git worktree is clean (`git status --porcelain` should be empty)
3. Run `pnpm boilerplate upgrade prepare --project <path> --to <target-version>`

## Session Structure

After preparation, the `.boilerplate/upgrade/` directory contains:

```
.boilerplate/
  boilerplate.json       # Project tracking (committed)
  upgrade/               # Temporary workspace (not committed)
    reference/
      source/            # Source version reference files
      target/            # Target version reference files
    intentions/          # Migration intention files
    upgrade-session.md   # Main session prompt
    status.md            # Current status report
```

## Execution Workflow

### For Each Intention

1. **Read the intention file**
   - Location: `.boilerplate/upgrade/intentions/<intention-id>.md`
   - Understand the goal, why, and reference paths

2. **Run applicability checks**
   - Check "Applies when" conditions
   - Check "Do not apply when" conditions
   - If not applicable, record as skipped with reason

3. **Compare with references** (if useful)
   - Source: `.boilerplate/upgrade/reference/source/`
   - Target: `.boilerplate/upgrade/reference/target/`
   - Understand what changed and why

4. **Apply the smallest safe change**
   - Adapt existing code, don't replace wholesale
   - Preserve all project-specific behavior
   - Avoid cosmetic changes unless required

5. **Run validation**
   - Intention-specific validation from the file
   - Global checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

6. **Update boilerplate.json**
   - Add intention ID to `intentions.applied` with today's date
   - Only after validation passes

7. **Commit the change**
   - One commit per intention
   - Clear commit message: `feat: apply migration intention <intention-id>`

### Stop Conditions

Stop immediately if:
- A "Do not apply when" condition matches
- Validation fails after reasonable attempts
- Unsafe ambiguity is detected
- Project-specific behavior would be lost

### Recording Results

**Applied:**
```json
{
  "intentions": {
    "applied": [
      { "id": "v1.6.0/add-s3-module", "appliedAt": "2026-04-30" }
    ]
  }
}
```

**Skipped:**
```json
{
  "intentions": {
    "skipped": [
      { "id": "v1.6.0/web-ssr-monitoring", "reason": "Project does not use web-ssr" }
    ]
  }
}
```

**Blocked:**
- Write to `.boilerplate/upgrade/blocked.md`
- Include: intention ID, reason, failed checks, suggested next actions
- Do NOT update boilerplate.json

## Git Rules

- **Never** stash automatically
- **Never** push automatically
- **Never** merge automatically
- Create one commit per resolved intention
- Keep successful commits if a later intention fails
- Create a dedicated upgrade branch

## Validation Rules

For each intention:
1. Run intention-specific validation first
2. Run global checks when available
3. Report missing scripts as unavailable, not passed
4. Block the intention if required validation fails

### Global Checks

- `pnpm lint` - Code style and quality
- `pnpm typecheck` - TypeScript type checking
- `pnpm test` - Unit and integration tests
- `pnpm build` - Build verification

## Reporting

### During Execution

- Update `.boilerplate/upgrade/status.md` with progress
- Mark intentions as applied/skipped/blocked

### On Completion

- Generate final summary for PR description
- Include:
  - Total intentions processed
  - Applied intentions list
  - Skipped intentions with reasons
  - Blocked intentions (if any)
  - Validation results

## Example Session

```bash
# 1. Initialize (if needed)
pnpm boilerplate upgrade init --project ./my-project

# 2. Check status
pnpm boilerplate upgrade status --project ./my-project

# 3. Prepare upgrade context
pnpm boilerplate upgrade prepare --project ./my-project --to 1.6.0

# 4. AI agent executes intentions from .boilerplate/upgrade-session.md
# (This is done by the AI agent, not manually)

# 5. Review the upgrade branch
git log --oneline
git diff main..upgrade/v1.5.0-to-v1.6.0

# 6. Create PR when satisfied
```

## Best Practices

1. **Preserve project identity**: Never overwrite project-specific code
2. **Minimal changes**: Apply only what's necessary for the intention
3. **Validate early**: Run checks before committing
4. **Document decisions**: Record clear reasons for skips and blocks
5. **Atomic commits**: One intention = one commit
6. **Safe failures**: Stop on ambiguity, don't guess
