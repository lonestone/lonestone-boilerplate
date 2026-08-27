# Release maintainer runbook

This is the procedure for publishing a new boilerplate version. The Release PR does the plumbing: version bump, generated changelog, and (after you merge) the tag. You are a plumber, not an author. Authors already wrote intentions in `unreleased/` on their feature PRs.

Use it on the **release-please Release PR** (label `autorelease: pending`). Every step works by hand too.

## Definitions

- **Release version**: the SemVer version on the Release PR, tagged as `vX.Y.Z` after merge.
- **Previous version**: the latest published boilerplate tag before this release.
- **Consumer project**: a project generated from this boilerplate and now diverged.
- **Migration intention**: a markdown file that explains how to adapt a consumer project from a previous release to this one.
- **Tracked domain**: an area a consumer project follows from the boilerplate. Valid names live in `commitlint.config.ts` — never restate the list here.

## Rule of thumb

Don't write one vague intention for a whole release. For every meaningful change, decide one of four outcomes:

- `no-migration`: only new projects receive it, or existing projects have nothing meaningful to do.
- `informational`: consumers should know about it, but there's no safe action to hand them.
- `migration`: an existing project can apply a bounded, testable adaptation.
- `breaking-manual`: an existing project may need the change, but a human must decide before anyone edits.

If a project doesn't use a capability, don't force it on them. Put optional capabilities in their own domain so a project that doesn't track that domain skips them automatically.

One rule has no exceptions: **never write an unbounded "update dependencies" step.** A version bump is never just a JSON line — it drags in breaking changes, peer cascades, and a test pass. Dependency changes go through exactly three channels:

- **Plumbing** (engines, packageManager, the catalogs mechanism) — `align-dependency-baseline`, zero bumps.
- **Coherent-set alignment** — `align-shared-dependency-versions`: one catalog family at a time, validated and committed per family, with pin-and-name as the escape hatch. Releases that change catalog versions rely on this protocol.
- **Framework migrations** — the owning intention ships its own bumps and documents the breakage. The MikroORM intention bumps `@mikro-orm/*`; a React major would get its own intention.

## Intention authoring (on the feature PR)

This section is the canon the `boilerstone-intention` skill points to. Write the intention **in the same PR as the code**, while the context is fresh. The release maintainer does not reconstruct five PRs' worth of "why".

1. Copy [TEMPLATE.md](../migration-intentions/TEMPLATE.md) to `.boilerstone/migration-intentions/unreleased/slug.md`.
2. No `NN-` prefix. The filename is `slug.md`. The frontmatter `id:` is `unreleased/slug`. Optional `pr:` records the pull request number.
3. Fill every required section. **Why is required** — that is the decision the release maintainer cannot invent later.
4. Domain / scope values live in `commitlint.config.ts`. Do not copy the list into the intention.
5. Keep the intention narrow. One bounded adaptation, not "update tooling".
6. Each intention must answer: **Goal**, **Why**, **Applies When**, **Do Not Apply When**, **Observable Gaps** (3–6 greppable deltas with a staged reference and a binary "Done when"), **Out of Scope**, **Reference Paths** (`copy` or `adapt` on every path; no lockfiles, no generated artifacts), **Validation**, **Record Result**.

Not every PR yields an intention. Refactors and boilerplate-internal CI take the `no-intention` label instead and appear only in the generated changelog.

## Drafting the release note (before or on the Release PR)

The note is a file: `apps/documentation/src/content/docs/releases/vX.Y.Z.mdx`. The CI check on the Release PR only cares that this file exists on the PR HEAD. It does not care *when* it was written.

Write it as soon as you know why the bundle exists — on a regular PR into `main`, or later on the Release PR. Waiting for the Release PR to exist first is a circle: that PR only appears after a push to `main`, and the story is easiest to write while the work is still fresh.

How to name the file:

- If the Release PR is already open, read `X.Y.Z` from `.release-please-manifest.json` on that branch. Do not pick a version by hand.
- If it is not open yet, dry-run release-please (`npx release-please release-pr --dry-run --repo-url <owner/repo> --target-branch main`) and use the version it would open. If the filename later disagrees with the Release PR, **rename the file** — do not rewrite the story.

A few sentences on why this release exists and what the bundle means for consumers. Not a second changelog. This repository sets the `REQUIRE_RELEASE_NOTE` variable, so CI refuses to merge the Release PR without that file (the check is optional by default on consumer projects).

## Working the Release PR

The version number is already chosen. `CHANGELOG.md` is already generated. Do not pick a version by hand. Do not edit the changelog. Do not tag. Do not merge — that is the human's final act; release-please creates the tag after merge.

release-please **force-pushes** this branch on every push to `main` (`always-update` in `release-please-config.json`). Extra commits you add here — promoted intentions, the example version bump — disappear if `main` moves afterwards. Do this work when the bundle is ready to ship, then merge before the next push to `main`. If the branch was rewritten, re-run promote.

1. Check out the Release PR (`autorelease: pending`). Read the next version from `.release-please-manifest.json`.
2. Review the generated `CHANGELOG.md`. It is the inventory. Do not stamp or rename it.
3. Promote staged intentions:

```bash
pnpm boilerplate intentions promote --to X.Y.Z
```

That creates `migration-intentions/vX.Y.Z/` if needed (with README markers), moves each `unreleased/*.md` (not the README) to `vX.Y.Z/NN-slug.md` in filename-sort order, and rewrites `id:` / `requires:` from `unreleased/slug` to `vX.Y.Z/slug`. Adjust `NN-` prefixes and cross-PR `requires:` by hand afterwards if the sort order is wrong.

4. Staleness-check against the actual diff. A later PR may have changed files an earlier intention still references:

```bash
git diff --name-status vPREVIOUS..HEAD
```

5. Confirm the release note exists (`apps/documentation/src/content/docs/releases/vX.Y.Z.mdx`). It may already be on `main` from an earlier PR — that is the intended path, not a shortcut. If it is missing, write it here. See [Drafting the release note](#drafting-the-release-note-before-or-on-the-release-pr).
6. Confirm staged intentions were promoted. The **Intention promote** check fails until every `unreleased/*.md` that was on `main` has moved to `vX.Y.Z/NN-slug.md` with `id: vX.Y.Z/slug`. If it fails, the error is the command to run. A release that had nothing in `unreleased/` passes. GitHub has no yellow “needs work” check that also blocks merge, so this one fails like the other gates.
7. Update `.boilerstone/boilerplate.example.json` so `source.currentVersion` is `X.Y.Z`. Only maintainers edit this example file, and only at release time.
8. Validate:

```bash
pnpm boilerplate intentions sync
pnpm boilerplate intentions lint
pnpm boilerplate upgrade path --from <previous-version> --to <next-version> --json
pnpm fmt:check
pnpm typecheck
pnpm test
```

`intentions sync` regenerates the release README's intentions block — `intentions lint` fails when it's stale. Review the `upgrade path` output: expected intentions present, optional capabilities filtered by domain, informational and no-migration entries absent from the actionable path, no metadata warnings.

If this release changed CLI command behavior, flags, safety rules, or the meaning of a term used in the docs, update the matching `.boilerstone/docs/` pages in the same PR. The changelog line is not enough.

9. Smoke test as a consumer (see below).
10. Stop. Hand the Release PR back. **Never tag. Never merge.** The human merges from the GitHub UI as themselves. After merge, release-please creates `vX.Y.Z`.

## Smoke test as a consumer

Before handing back:

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

After the human has merged and the tag exists, verify with a remote install:

```bash
curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- init test-boilerstone --ref vX.Y.Z
pnpm boilerplate upgrade prepare --to X.Y.Z --fetch
```

Never move a published tag. If a pushed tag turns out to be wrong, publish a new patch version instead.

## Selective shipping (D12)

The client-wants-B-without-A problem (both merged, A must not ship):

1. **Preferred: feature flags.** An env-var check (`FEATURE_X=true`) read in one place. A merges but ships dark.
2. **Escape hatch: release branch.** Branch from the last release tag, cherry-pick B's squash commit (one commit per PR), cut a patch from that branch. Release-please can release from a non-`main` branch. `main`'s next normal release includes both A and B and the branch dies.
3. Delaying the merge is acceptable occasionally, bad as a habit.

The versioned release gate removes most other cherry-picking: merging no longer means deploying to production, so unfinished sets can merge freely.

## What an agent should do when asked to prepare the release

When the user says "prepare the release" or "work the Release PR":

1. Read this runbook.
2. If there is no Release PR yet, draft (or finish) `releases/vX.Y.Z.mdx` on a regular PR using a release-please dry-run for the version, then stop. Do not promote intentions, do not tag, do not merge.
3. If the Release PR is open, operate on it — do not invent a version, a tag, or a merge.
4. Promote `unreleased/` into `vX.Y.Z/`, then let the maintainer adjust `NN-` and `requires:`.
5. Staleness-check intentions against `git diff vPREVIOUS..HEAD`.
6. Confirm the release note exists; draft it only if it is missing. The human finishes the tone.
7. Run the validation commands and the smoke test.
8. Stop. Never tag. Never merge the Release PR.
