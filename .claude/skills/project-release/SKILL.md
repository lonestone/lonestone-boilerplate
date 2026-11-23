---
name: project-release
description: Prepare a consumer project release by drafting the release note and verifying the Release PR. Use when the user asks to "prepare the release" on a consumer project.
---

# Project release

This skill is a thin adapter. The canon lives at `apps/documentation/src/content/docs/references/1_release_and_versionning.mdx` — read it first. Also read `CONTRIBUTING.md`. Do not invent a different release process.

## Preflight

<!-- boilerstone:producer-only:begin -->

In the boilerplate repository (see "Producer or consumer" in `.boilerstone/README.md`) stop and point the user to `boilerstone-release`.

<!-- boilerstone:producer-only:end -->

1. This skill is for consumer projects that version with release-please.
2. **Never tag. Never merge the Release PR.** Those are human steps. Green checks are not consent to ship.

## Job

1. Ship in batches. Merge the pull requests of the batch first, then make one release. Follow "Ship in batches" in the canon. Do not open a release for each pull request.
2. Find the open Release PR (label `autorelease: pending`). Wait until the batch is merged, because its version changes with every merge.
3. Read the next version from `.release-please-manifest.json` on the Release PR.
4. Write `apps/documentation/src/content/docs/releases/vX.Y.Z.mdx` last, on the Release PR branch, just before the human merges it. Use `CHANGELOG.md` and `git show` on the listed commits. The note is the human story of why this release exists. It is not a second changelog. If the version moved, rename the file. Do not rewrite the story.
5. If the Release PR is open, verify its checks. The release-note check only blocks when the repository variable `REQUIRE_RELEASE_NOTE` is `true`; write the note anyway — it is the point of this skill. If a check fails, the error is the fix.

## After the human merges

Merging the Release PR publishes the tag and images. It does not update production — unless the repository variable `PROMOTE_ON_RELEASE` is set, in which case Promote is dispatched automatically once the images are built (and may wait on an environment approval). Otherwise, point the user at Actions → **Promote** (or the link on the GitHub Release). Do not run Promote unless they ask.

If the Release Please run on `main` fails with `Release vX.Y.Z is held`, the Release PR was merged without its note and `REQUIRE_RELEASE_NOTE` is `true`. Nothing was published. Write the note on a regular pull request into `main`. Its merge publishes the release. Do not tag by hand.

## Guardrails

- Do not write intentions. Consumer projects have no intention machinery.
- Do not edit `CHANGELOG.md` by hand. It is generated.
- Do not invent process beyond the canon pages and the release-note file.
- Do not add auto-merge for the Release PR.
- Do not hook staging and production to the same `latest` image tag.
