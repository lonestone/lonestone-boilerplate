---
id: unreleased/build-release-images-from-release-please
domain: ci
classification: migration
requires:
  - v1.1.0/adopt-release-please
pr: 200
---

# Build the release images from the Release Please run

## Goal

Merging the Release PR builds the version images (`X.Y.Z`, `X.Y`, `latest`) of every app, and `PROMOTE_ON_RELEASE` deploys them, all from the Release Please run.

## Why

Release Please pushes its `v*` tag with `GITHUB_TOKEN`, and GitHub starts no workflow for a push made with that token. So `push-to-ghcr.yml`, which listened for `v*` tags, never ran for a release. `promote-on-release.yml`, which waits for that build, was skipped every time. A merged Release PR left only the `sha-…` image of the merge commit. Promote then asked Dokploy for a `X.Y.Z` image that did not exist. The boilerplate itself shipped v1.1.0, v1.2.0 and v1.3.0 without one version image on GHCR.

The fix is the one `release-please.yml` already used for the CLI: do the follow-up work in the same run. `push-to-ghcr.yml` and `promote-on-release.yml` become callable (`workflow_call`) with the tag as input, and `release-please.yml` calls them when it creates a release. A called workflow keeps the caller's `github.ref` (`refs/heads/main`), so everything that depends on the version reads `inputs.tag`.

A personal access token or a GitHub App token for Release Please would also make the tag start workflows. Both were rejected: each needs a secret in every project, and a PAT belongs to one person and expires.

`promote.yml` now checks that every mapped image exists on GHCR before it calls Dokploy. The apps are built in parallel, and one failed app does not stop the others, so a failed release build can leave a partial set of version tags. Gating the version tags on the whole matrix was rejected: it needs a second retag stage for a case that Promote now catches, and a manual rebuild repairs.

## Applies When

- The project tracks the `ci` domain.
- `.github/workflows/release-please.yml` exists (the project is versioned).
- `.github/workflows/push-to-ghcr.yml` has no `workflow_call` trigger, or `release-please.yml` has no job that uses `./.github/workflows/push-to-ghcr.yml`.

## Do Not Apply When

- The project has no `.github/workflows/release-please.yml`. It ships without versions, and its images come from pushes on the default branch. Record as skipped with that reason.
- A human has already made release tags start workflows another way (a PAT or GitHub App token passed to `release-please-action`, or tags pushed by a person) and wants to keep it. Record as skipped with that reason.

## Observable Gaps

1. **Callable image build** — signal: `rg -n "workflow_call" .github/workflows/push-to-ghcr.yml` finds nothing.
   Adapt the staged reference `push-to-ghcr.yml`: the `workflow_call` and `workflow_dispatch` inputs `tag`, the `Check the release tag` step, the checkout `ref`, the `Read the built commit` step, and the `tags` and `labels` of the metadata step. Keep the project's image matrix, Dockerfiles, registry, and any extra job (a redeploy webhook, for example). An extra job that tests `github.ref` for a tag must also accept `inputs.tag`.
   Done when: the file has `workflow_call` with a required `tag` input, and every `type=semver` line has `value=${{ inputs.tag }}`.

2. **Release Please calls the build** — signal: no job in `.github/workflows/release-please.yml` has `uses: ./.github/workflows/push-to-ghcr.yml`.
   Adapt the `release-images` job from the staged reference, with its four permissions. Pass any secret the project's own extra jobs need through `secrets:` (and declare it under `workflow_call.secrets` in `push-to-ghcr.yml`).
   Done when: `release-images` exists, needs `release-please`, and runs only when `release_created` is `true`.

3. **Callable promote on release** — signal: `.github/workflows/promote-on-release.yml` exists and has no `workflow_call` trigger.
   Copy the staged reference `promote-on-release.yml`, and adapt the `promote-release` job into `release-please.yml`. Keep the `workflow_run` trigger: it still serves a tag pushed by a person.
   Done when: `promote-on-release.yml` has both triggers, checks the tag matches `vX.Y.Z`, and `promote-release` needs `release-images`.

4. **Promote checks the images** — signal: `.github/workflows/promote.yml` has no `docker manifest inspect`.
   Adapt the staged reference: the `packages: read` permission and the check loop before the Dokploy calls. Keep the project's own host calls if it does not deploy on Dokploy.
   Done when: Promote fails before any Dokploy call when one mapped image is missing.

5. **Docs** — signal: `apps/documentation/src/content/docs/references/1_release_and_versionning.mdx` still says to wait for **Build Docker to GHCR** for the tag.
   Adapt the "What the pipeline produces" section and the Promote prerequisites from the staged reference, in every language the project keeps.
   Done when: the page says the release images are built in the Release Please run.

## Out of Scope

- Rebuilding the images of releases already published. A human may run **Build Docker to GHCR** by hand with their tag, if an environment needs one.
- Setting `PROMOTE_ON_RELEASE`, GitHub Environments, or Dokploy secrets.
- The `publish-cli` job of `release-please.yml`: it belongs to the boilerplate repository only.
- The image matrix, the Dockerfiles, and the image names.

## Reference Paths

- `.github/workflows/push-to-ghcr.yml` — **adapt**
- `.github/workflows/release-please.yml` — **adapt**
- `.github/workflows/promote-on-release.yml` — **copy**
- `.github/workflows/promote.yml` — **adapt**
- `apps/documentation/src/content/docs/references/1_release_and_versionning.mdx` — **adapt**

## Validation

- `actionlint` reports nothing on the four workflows (for example `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`).
- A push to the default branch still builds one `sha-…` image per app, and **Promote on release** is skipped for it.
- After the next Release PR merge, the Release Please run shows **Build the release images** green, and GHCR has `X.Y.Z`, `X.Y` and `latest` for every app.
- With `PROMOTE_ON_RELEASE` set, the same run dispatches a **Promote** run for `X.Y.Z`.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/build-release-images-from-release-please --applied` after validation passes, or record it as skipped with a reason.
