# Release maintainer runbook

This is the procedure for publishing a new boilerplate version. Like the upgrade runbook, it's written for the normal workflow — a maintainer piloting an agent, with git, the CLI, and the tests as tools — but every step works by hand too.

Use it every time the boilerplate changes in a way consumers may need to understand later. Don't release from memory: the whole value of a release is the accuracy of its intentions, and accuracy doesn't survive improvisation.

## Definitions

- **Release version**: the SemVer version that will be tagged as `vX.Y.Z`.
- **Previous version**: the latest published boilerplate tag before this release.
- **Consumer project**: a project generated from this boilerplate and now diverged.
- **Migration intention**: a markdown file that explains how to adapt a consumer project from a previous release to this one.
- **Tracked domain**: an area a consumer project follows from the boilerplate, such as `tooling`, `api`, `frontend`, `auth`, `ai`, or `docker-env`.

## Rule of thumb

Don't write one vague intention for a whole release. For every meaningful change, decide one of four outcomes:

- `no-migration`: only new projects receive it, or existing projects have nothing meaningful to do.
- `informational`: consumers should know about it, but there's no safe action to hand them.
- `migration`: an existing project can apply a bounded, testable adaptation.
- `breaking-manual`: an existing project may need the change, but a human must decide before anyone edits.

If a project doesn't use a capability, don't force it on them. Put optional capabilities in their own domain — AI-related changes use the `ai` domain, so a project without AI skips them automatically.

One rule has no exceptions: **never write an unbounded "update dependencies" step.** A version bump is never just a JSON line — it drags in breaking changes, peer cascades, and a test pass. Dependency changes go through exactly three channels:

- **Plumbing** (engines, packageManager, the catalogs mechanism) — `align-dependency-baseline`, zero bumps.
- **Coherent-set alignment** — `align-shared-dependency-versions`: one catalog family at a time, validated and committed per family, with pin-and-name as the escape hatch. Releases that change catalog versions rely on this protocol.
- **Framework migrations** — the owning intention ships its own bumps and documents the breakage. The MikroORM intention bumps `@mikro-orm/*`; a React major would get its own intention.

## Changelog discipline (every PR, not just releases)

Release preparation starts at PR time. Every PR with consumer-visible impact adds curated entries under `## [Unreleased]` in the root `CHANGELOG.md`, using the Keep a Changelog headings (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`, plus `Migration`). The `Changelog` CI check (`pnpm boilerplate changelog check --base origin/main`) refuses a PR that changes files without touching the changelog; label a PR `no-changelog` only when it truly has no consumer-visible impact.

Write the *meaning* of the change, one line per change, while it's fresh. Never paste commit messages — a month later they tell you nothing.

## 1. Pick the version

1. Inspect the last release tag:

```bash
git tag --list 'v*' --sort=-v:refname
```

2. Choose the next version:

- Patch (`1.0.1`): fixes to release tooling, docs, tests, or non-breaking compatibility.
- Minor (`1.1.0`): new optional modules, new conventions, new generated-project capabilities.
- Major (`2.0.0`): breaking baseline changes that most consumers must decide on manually.

3. Create the release directory:

```bash
mkdir -p .boilerstone/migration-intentions/vX.Y.Z
```

## 2. Inventory the changes

Start with the `## [Unreleased]` section of the root `CHANGELOG.md`. Every merged PR with consumer-visible impact added its entry there while the context was fresh (the CI gate enforces it; `no-changelog` PRs opted out explicitly). Those entries are your candidate intentions.

Then cross-check against the actual diff since the previous tag:

```bash
git diff --name-status vPREVIOUS..HEAD
```

A change without a changelog entry, or an entry without a matching change, is a hole. Resolve it before classifying anything.

Group the changed files by domain:

- `tooling`: package manager, scripts, lint, format, TypeScript, test runner, workspace config.
- `api`: NestJS app structure, DB config, entities, API tests, generated API contracts.
- `frontend`: SPA/SSR app structure, React patterns, frontend env, routing, UI usage.
- `auth`: Better Auth config, auth entities, guards, sessions, permissions.
- `email`: SMTP/MailDev, email service, email templates.
- `storage`: S3/MinIO, upload flows, file storage services.
- `monitoring`: Sentry, OpenTelemetry, Langfuse tracing.
- `ai`: AI module, prompts, model providers, rate limits, AI observability.
- `docker-env`: Docker Compose, `.env.example`, ports, service names.
- `ci`: GitHub Actions, release automation, checks.

Then decide the classification for every meaningful change (see the rule of thumb above).

## 3. Classify every change

There's no separate classification file — classification lives in each intention's own frontmatter (`classification: no-migration | informational | migration | breaking-manual`). Release-level "no-migration" prose (what ships as baseline with no consumer action) goes in the release README's intro, under a `## Shipped as baseline (no migration)` section.

Rules:

- If it changes generated project behavior, classify it.
- If an existing project may need a code or config change, write an intention.
- If the change is optional, use the optional domain and explicit skip conditions.
- If the change touches persisted data, auth semantics, production infra, or destructive migrations, use `breaking-manual` unless the safe path is obvious.

## 4. Write one intention per actionable adaptation

Copy the template:

```bash
cp .boilerstone/migration-intentions/TEMPLATE.md .boilerstone/migration-intentions/vX.Y.Z/slug.md
```

Each intention must be narrow. Good names:

- `standardize-oxlint-oxfmt`
- `migrate-mikro-orm-v7`
- `align-better-auth-session-schema`
- `add-sentry-otel-bootstrap`
- `adopt-ai-rate-limit-middleware`

Bad names — if you're writing one of these, you're bundling several changes:

- `update-tooling`
- `sync-api`
- `apply-v1-1`
- `modernize-project`

Name each file `NN-slug.md`, where `NN` is a zero-padded execution-order prefix (`00`, `01`, `02`, …). The filename sort order within the release directory *is* the execution order. The frontmatter `id:` never carries the `NN-` prefix. Declare dependencies with `requires:` in the frontmatter (a list of intention ids); `pnpm boilerplate intentions lint` checks that every `requires:` id exists and appears earlier in the execution order.

Each intention must answer:

- **Goal**: what end state should the consumer reach?
- **Why**: why did the boilerplate change?
- **Applies When**: exact checks that make this relevant.
- **Do Not Apply When**: exact skip/stop conditions.
- **Observable Gaps**: 3–6 independent, detectable deltas — each with a greppable signal, the reference file to compare, and a binary "Done when".
- **Out of Scope**: what the intention must not touch, even if it looks related.
- **Reference Paths**: files to compare between the source and target refs. Every path declares `copy` (the target is the source of truth) or `adapt` (project-specific deltas must survive). `upgrade prepare` stages these paths from both refs, so keep the list small — no lockfiles, no generated artifacts. The producer lint rejects a missing policy; already-published legacy intentions default to `adapt`, which is the safe direction.
- **Validation**: commands or checks that prove the adaptation worked.
- **Record Result**: the exact `upgrade record` command.

## 5. Update release metadata

Stamp the accumulated changelog section with the chosen version:

```bash
pnpm boilerplate changelog release --to X.Y.Z
```

This renames `## [Unreleased]` to `## [X.Y.Z] - date` and re-creates a fresh empty `[Unreleased]` section. It refuses an empty section (nothing to release) and versions that already exist. Then review and refine the stamped section:

- summarize the full release for humans;
- list important new baseline capabilities;
- list migration-relevant changes by domain;
- mention optional domains explicitly.

Update `.boilerstone/boilerplate.example.json`:

```json
{
  "source": {
    "currentVersion": "X.Y.Z"
  }
}
```

Only maintainers edit this example file, and only at release time. Consumers never edit their state by hand — they go through `upgrade record` and `upgrade finish`.

## 6. Validate the release draft

Run `pnpm boilerplate intentions sync` to regenerate the release README's intentions block — `intentions lint` fails when it's stale.

```bash
pnpm fmt:check
pnpm typecheck
pnpm test
pnpm boilerplate intentions sync
pnpm --filter @boilerstone/boilerplate lint:intentions
pnpm boilerplate upgrade path --from <previous-version> --to <next-version> --json
```

Review the `upgrade path` output:

- the expected intentions are present;
- optional capabilities are filtered out by domain when not tracked;
- informational and no-migration entries are absent from the actionable path;
- no intention has metadata warnings.

If this release changed CLI command behavior, flags, safety rules, or the meaning of a term used in the docs, update the matching `.boilerstone/docs/` pages (`how-it-works.md`, `upgrade-runbook.md`, and the docs-app explanation page) in the same PR. The changelog entry is not enough — agents and humans execute from those runbooks.

## 7. Smoke test as a consumer

Before tagging, create a temporary consumer project and run the lifecycle:

```bash
tmp="$(mktemp -d)"
git clone --depth 1 . "$tmp/app"
cd "$tmp/app"
pnpm install
pnpm rock
pnpm boilerplate upgrade status --json
```

If the release affects the existing-project onboarding path, use a separate temporary project and run:

```bash
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- onboard
pnpm boilerplate upgrade status
```

## 8. Tag and publish

After merge to `main`:

```bash
git checkout main
git pull --ff-only
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

Never move a published tag. If a pushed tag turns out to be wrong, publish a new patch version instead.

## 9. Verify the published release

Check the remote tags:

```bash
git ls-remote --tags origin 'v*'
```

Then run a remote install smoke test:

```bash
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- init test-boilerstone --ref vX.Y.Z
```

Finally, prepare an upgrade from the previous version in a test consumer:

```bash
pnpm boilerplate upgrade prepare --to X.Y.Z --fetch
```

## 10. What an agent should do when asked to release

When the user says "prepare a boilerplate release":

1. Read this runbook.
2. Ask for the target version if it isn't obvious.
3. Inspect the diff since the previous tag.
4. Propose the classification before writing intentions.
5. Write or update one intention per actionable adaptation.
6. Run the validation commands.
7. Stop before tagging unless the human explicitly asks to tag.
