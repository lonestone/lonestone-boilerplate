---
name: project-release
description: Prepare a consumer project release by drafting the release note and verifying the Release PR. Use when the user asks to "prepare the release" on a consumer project.
---

# Project release

This skill is a thin adapter. The canon lives at `apps/documentation/src/content/docs/references/1_release_and_versionning.mdx` — read it first. Also read `CONTRIBUTING.md`. Do not invent a different release process.

## Preflight

1. If `.boilerstone/migration-intentions/` exists, this is the boilerplate repository (producer). Stop and point the user to `boilerstone-release`.
2. This skill is for consumer projects that version with release-please.
3. **Never tag. Never merge the Release PR.** Those are human steps. Green checks are not consent to ship.

## Job

1. Find the open Release PR (label `autorelease: pending`) if it exists. Otherwise draft the note on a regular PR targeting `main`.
2. Read the next version from `.release-please-manifest.json` on the Release PR, or from a release-please dry-run if that PR is not open yet.
3. Draft `apps/documentation/src/content/docs/releases/vX.Y.Z.mdx` from `CHANGELOG.md` plus `git show` on the listed commits. The note is the human story of why this release exists. It is not a second changelog. Writing it *before* the Release PR exists is fine — the file just has to be on that PR's HEAD when it is merged. If the version later disagrees, rename the file.
4. If the Release PR is open, verify its checks. The release-note check only blocks when the repository variable `REQUIRE_RELEASE_NOTE` is `true`; write the note anyway — it is the point of this skill. If a check fails, the error is the fix.

## After the human merges

Merging the Release PR publishes the tag and images. It does not update production — unless the repository variable `PROMOTE_ON_RELEASE` is set, in which case Promote is dispatched automatically once the images are built (and may wait on an environment approval). Otherwise, point the user at Actions → **Promote** (or the link on the GitHub Release). Do not run Promote unless they ask.

## Guardrails

- Do not write intentions. Consumer projects have no intention machinery.
- Do not edit `CHANGELOG.md` by hand. It is generated.
- Do not invent process beyond the canon pages and the release-note file.
- Do not add auto-merge for the Release PR.
- Do not hook staging and production to the same `latest` image tag.
