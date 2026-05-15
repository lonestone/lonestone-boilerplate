---
name: upgrade-boilerplate
description: Sync changes from the upstream boilerplate repository into a project that was forked from it. Use when the user asks to "upgrade boilerplate", "sync from boilerplate", "pull boilerplate updates", "merge boilerplate", "rebase on boilerplate", or similar. Refuses to run on the boilerplate itself (detected via origin URL). Persists the last sync point in the root package.json under the `boilerplate` key so subsequent runs only consider new upstream commits.
---

# Upgrade Boilerplate

Sync changes from an upstream boilerplate repository into the current project (a fork of that boilerplate). Designed to be safe, transparent, and resumable across sessions, even when the boilerplate remote isn't yet configured.

## Refuse to run on the boilerplate itself

Before doing anything else, check `git remote get-url origin`. If the URL contains any of the known boilerplate slugs below, stop and tell the user the skill is for forks only.

Known boilerplate slugs (extend the list when introducing the skill to additional upstreams):

- `lonestone-boilerplate`

## Configuration: where the state lives

Sync state lives in the root `package.json` under a custom `boilerplate` key:

```jsonc
{
  "name": "...",
  // ...other fields...
  "boilerplate": {
    "remoteUrl": "git@github.com:lonestone/lonestone-boilerplate.git",
    "remoteName": "boilerplate",
    "remoteBranch": "main",
    "lastSync": {
      "boilerplateCommit": "<full SHA at upstream tip when last synced>",
      "projectCommit": "<full SHA of the project's last sync commit>",
      "date": "<ISO date>"
    }
  }
}
```

npm/pnpm ignore unknown top-level fields, so this is safe. If `boilerplate` is missing, treat it as a first-time sync.

## Step-by-step

### 1. Load or initialize state

- If `package.json.boilerplate.remoteUrl` is set, use it.
- Otherwise ask the user for the boilerplate's git URL. Default remote name: `boilerplate`. Default branch: `main`. Confirm both with the user before adding the remote.

### 2. Ensure the boilerplate remote is configured

```bash
git remote | grep -qx "$REMOTE_NAME" || git remote add "$REMOTE_NAME" "$REMOTE_URL"
git fetch "$REMOTE_NAME"
```

### 3. Determine the diff range

- Upstream tip: `<remoteName>/<remoteBranch>` (e.g. `boilerplate/main`).
- Last sync point:
  - If `package.json.boilerplate.lastSync.boilerplateCommit` is set, use it.
  - Otherwise: `git merge-base HEAD <remoteName>/<remoteBranch>` to detect the divergence point automatically. Tell the user the SHA you found so they can confirm.

`git log <last-sync>..<remoteName>/<remoteBranch> --oneline` is the candidate list. Also note the count of project-side commits since divergence (`git log <last-sync>..HEAD --oneline`) so you know how much custom work you're protecting.

### 4. Categorize and propose a plan

Group candidate commits into themes before applying. Default categories:

| Theme | Examples | Default strategy |
|---|---|---|
| Documentation / cursor rules | `apps/documentation/**`, `.cursor/rules/**`, `AGENTS.md`, `CLAUDE.md` | Path-sync wholesale, preserve project-only files (e.g. a project CHANGELOG), re-apply small project tweaks afterwards |
| CI / GitHub workflows | `.github/**` | Path-sync if untouched on project side, otherwise merge per file |
| Tooling | `.husky/**`, `nest-cli.json`, `eslint.config.ts`, `tsconfig.json` | Path-sync, but diff first to spot project customization |
| Generator / shared packages config | `packages/openapi-generator/{*.env.example,preprocess,index.ts}`, `packages/i18n/package.json` (non-generated) | Path-sync the non-generated bits |
| Build/test framework migration | jest→vitest, tsx→swc, etc. | Cherry-pick the relevant commit, expect heavy conflicts, validate end-to-end |
| Module refactors in customized areas | `apps/api/src/modules/auth/**` if the project has customized auth | Default to KEEP project version. The refactor can be a separate later PR. |
| New optional features | A new `apps/api/src/modules/<feature>` | Ask the user explicitly before adopting. Skip if the feature targets infra the project doesn't use (e.g. an AI module that wraps a different LLM client than the project's). |
| Modules the project removed | e.g. `apps/mobile/**` if removed | Skip; the commits are no-ops for the project. |
| Personal / accidental artifacts | Empty stray files, personal Docker images, Unicode-garbled package entries, npm package typos | Reject. Document the rejection in the commit body. |

Present the plan to the user with the proposed strategy per theme and ask for explicit confirmation per risky category (build/test migration, new features, refactors) before starting.

### 5. Execute as phased commits

Always work on a dedicated branch and tag a rollback point first.

```bash
TODAY=$(date +%Y-%m-%d)
git tag pre-sync-$TODAY HEAD
git checkout -b boilerplate-sync-$TODAY
```

Apply the plan as separate, well-named commits, one per phase. Suggested phases:

1. **Path-sync** the safe zones. Use `git checkout <remoteName>/<branch> -- <path>` per zone. Re-add project-only files that aren't in upstream. Manually merge dual-owned files (CLAUDE.md, README.md, .env.example).
2. **Cherry-pick** the heavy commits (test framework migration, etc.) and resolve conflicts in line with the strategy.
3. **Cherry-pick** opted-in new features (one phase per feature).
4. **Document the skips** in commit messages of relevant phases, with rationale.

After each phase, validate before moving on:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build
pnpm test
# Smoke test: pnpm dev, hit a known endpoint, kill it.
```

If a phase breaks something, stop and investigate before the next phase. Don't pile broken state.

### 6. Persist the new sync state

When the sync branch has been validated and you (or the user) is happy with it, update `package.json.boilerplate.lastSync` with:

- `boilerplateCommit`: the full SHA of `<remoteName>/<remoteBranch>` you synced from.
- `projectCommit`: the full SHA of the final commit on the sync branch.
- `date`: today's date in ISO 8601 (YYYY-MM-DD).

Commit this update as the final phase of the sync. This is what makes the next run incremental.

## Operational guidance from past syncs

These patterns came up repeatedly. Apply them as defaults; ask the user when in doubt.

### Watch for `catalog:` references when the project doesn't use pnpm catalogs

When the upstream adopts pnpm catalogs (`pnpm-workspace.yaml` `catalogs:` section), individual `package.json` files start referencing deps like `"i18next": "catalog:frontend"`. If the project hasn't adopted catalogs, these refs break `pnpm install`. Either:

- Adopt the catalogs structure as a separate explicit phase, or
- Revert the `catalog:` references back to concrete versions in the project's `package.json` files.

### Watch for peer dep version drift

Some upstream packages pin a peer dep at an older version that works because that release lacks an `exports` field in its `package.json`. After bumping (e.g. via `^X.Y.Z` resolving to a newer minor), deep imports start failing:

> Cannot find module '<pkg>/dist/<file>'

Pin to the exact version the upstream uses (no `^`), until the upstream code stops using the deep import.

### Reject artifacts that look like personal or accidental commits

Examples encountered in real syncs:

- Empty stray files (e.g. a file literally named `cross-env` with 0 bytes)
- Personal Docker images (`<author>/<image>` instead of an official org image)
- Unicode-garbled package entries (e.g. `"coverage-v8❯"`)
- Suspicious typo deps (e.g. `"test": "^3.3.0"` as a dev dep)

Drop them during conflict resolution and note the drop in the commit message body.

### Skip optional features the project doesn't use

If the upstream adds a module that targets infrastructure the project doesn't have (e.g. a Vercel AI SDK module while the project uses a different LLM client), skip the module's commits. Ask the user before adopting. The deps alone can be heavy.

### Don't take refactors of code the project has customized

If the upstream restructures a module the project has customized (e.g. an auth module refactored to a configurable-module pattern, in a project that has organization/teams logic in its auth service), default to KEEP the project version. The refactor can be revisited as a separate, focused PR later.

### Open upstream PRs for bugs you discover

If during sync you spot and fix a bug that affects the boilerplate (e.g. a hardcoded package name in a generator script, a Docker image swap with no justification), prepare a branch on the boilerplate remote and open a PR upstream so future syncs benefit.

### Commit messages

For each phase, the commit body should document:

- Which upstream commit(s) it adapts (by SHA, short prefix is fine).
- What was kept from the upstream commit, and what was rejected (with rationale).
- The verification done (typecheck, build, test, smoke).

This makes the next sync (or a revert) much easier to reason about.

## Output format

Keep status updates to the user concise. After each phase, give one paragraph: what changed, what was skipped (with rationale), what the validation showed. Save the plan with the user before starting, then narrate progress against it.
