# Release maintainer runbook

This is the concrete procedure for publishing a new boilerplate version. It is written for the normal workflow: a human maintainer pilots an agentic AI, and the agent uses git, the CLI, tests, and migration intention files as tools.

Use this runbook every time the boilerplate changes in a way that consumers may need to understand later.

## Definitions

- **Release version**: the SemVer version that will be tagged as `vX.Y.Z`.
- **Previous version**: the latest published boilerplate tag before this release.
- **Consumer project**: a project generated from this boilerplate and now diverged.
- **Migration intention**: a markdown file that explains how to adapt a consumer project from a previous release to this release.
- **Tracked domain**: the area a consumer project follows from the boilerplate, such as `tooling`, `api`, `frontend`, `auth`, `ai`, or `docker-env`.

## Rule of thumb

Do not write one vague intention for a whole release.

For every meaningful change, decide one of these outcomes:

- `no-migration`: consumers receive it only when creating a new project, or it has no meaningful action for existing projects.
- `informational`: consumers should know about it, but there is no safe automatic or semi-automatic action.
- `migration`: an existing project can apply a bounded, testable adaptation.
- `breaking-manual`: an existing project may need the change, but a human decision is required before edits.

If a project does not use a capability, do not force it. Put optional capabilities in their own domain when needed. For example, AI-related changes use the `ai` domain, so a project without AI skips them.

Dependency rule: **never write an unbounded "update dependencies" step.** A version bump is never just a JSON line — it implies breaking changes, peer cascades and testing. Three sanctioned channels, nothing else:

- **Plumbing** (engines, packageManager, catalogs mechanism) — `align-dependency-baseline`, zero bumps.
- **Coherent-set alignment** — `align-shared-dependency-versions`: one catalog family at a time, validated and committed per family, with pin-and-name as the escape hatch. Releases that change catalog versions rely on this protocol.
- **Framework migrations** — the owning intention ships its own bumps and documents the breakage (the MikroORM intention bumps `@mikro-orm/*`; a React major would get its own intention).

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

Compare this release with the previous tag:

```bash
git diff --name-status vPREVIOUS..HEAD
```

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

Then write a short release inventory in `.boilerstone/migration-intentions/vX.Y.Z/classification.md`.

## 3. Classify every change

Create `.boilerstone/migration-intentions/vX.Y.Z/classification.md` with this shape:

```markdown
# Change Classification - vX.Y.Z

## No Migration

- Short description of changes that do not require consumer action.

## Informational

- Short description of things consumers should know but not replay automatically.

## Migration Intentions

- [slug](./slug.md): one bounded adaptation that can be validated.

## Breaking / Manual

- [slug](./slug.md): one adaptation that must stop for a human decision before edits.
```

Rules:

- If it changes generated project behavior, classify it.
- If an existing project may need a code/config change, write an intention.
- If the change is optional, use the optional domain and explicit skip conditions.
- If the change touches persisted data, auth semantics, production infra, or destructive migrations, use `breaking-manual` unless the safe path is obvious.

## 4. Write one intention per actionable adaptation

Copy the template:

```bash
cp .boilerstone/migration-intentions/TEMPLATE.md .boilerstone/migration-intentions/vX.Y.Z/slug.md
```

Each intention must be narrow. Good examples:

- `standardize-oxlint-oxfmt`
- `migrate-mikro-orm-v7`
- `align-better-auth-session-schema`
- `add-sentry-otel-bootstrap`
- `adopt-ai-rate-limit-middleware`

Bad examples:

- `update-tooling`
- `sync-api`
- `apply-v1-1`
- `modernize-project`

Each intention must answer:

- **Goal**: what end state should the consumer reach?
- **Why**: why did the boilerplate change?
- **Applies When**: exact checks that make this relevant.
- **Do Not Apply When**: exact skip/stop conditions.
- **Observable Gaps**: 3-6 independent, detectable deltas — each with a greppable signal, the reference file to compare, and a binary "Done when".
- **Out of Scope**: what the intention must not touch, even if it looks related.
- **Reference Paths**: files to compare in source and target tags. `upgrade prepare` stages them, so keep them small — no lockfiles or generated artifacts.
- **Validation**: commands or checks that prove the adaptation worked.
- **Record Result**: the exact `upgrade record` command.

## 5. Update release metadata

Update the root `CHANGELOG.md` under the chosen version:

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

Do not edit generated consumer state by hand during upgrades. Maintainers update the example state before release; consumers use `upgrade record` and `upgrade finish`.

## 6. Validate the release draft

Run:

```bash
pnpm fmt:check
pnpm typecheck
pnpm test
pnpm --filter @boilerstone/boilerplate lint:intentions
pnpm boilerplate upgrade path --from <previous-version> --to <next-version> --json
```

Review the `upgrade path` output:

- expected intentions are present;
- optional capabilities are filtered by domain when not tracked;
- informational and no-migration entries are not in the actionable path;
- no intention has metadata warnings.

## 7. Smoke test as a consumer

Before tagging, create a temporary consumer project and test the lifecycle:

```bash
tmp="$(mktemp -d)"
git clone --depth 1 . "$tmp/app"
cd "$tmp/app"
pnpm install
pnpm rock
pnpm boilerplate upgrade status --json
```

If testing an existing-project onboarding path, use a separate temporary project and run:

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

Never move a published tag. If the tag is wrong after it was pushed, publish a new patch version.

## 9. Verify the published release

Check remote tags:

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

When the user says “prepare a boilerplate release”:

1. Read this runbook.
2. Ask for the target version if it is not obvious.
3. Inspect the diff since the previous tag.
4. Propose the classification before writing intentions.
5. Write or update one intention per actionable adaptation.
6. Run the validation commands.
7. Stop before tagging unless the human explicitly asks to tag.
