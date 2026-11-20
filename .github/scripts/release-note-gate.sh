#!/usr/bin/env bash
# Decides whether Release Please may publish the release that a merged Release PR is waiting for.
#
# Runs on every push to main, before release-please-action creates any tag. A Release PR that is
# merged but not yet tagged keeps the label "autorelease: pending". When one exists and the release
# note for its version is missing on main:
#   - REQUIRE_RELEASE_NOTE=true: exit 1. No tag, no GitHub Release, no images. Adding the note
#     through a pull request into main starts this workflow again, and the release is published then.
#   - otherwise: let the release through with the notes release-please generates.
#
# Writes "mirror=true" to GITHUB_OUTPUT when the note exists and should be copied to the GitHub
# Release, "mirror=false" otherwise.
#
# Inputs (environment): REQUIRE_RELEASE_NOTE, BASE_BRANCH (default main), GITHUB_OUTPUT, and a
# GH_TOKEN that lets `gh` list pull requests and read releases. Run from the repository root.
# It assumes a single package (the "." key of .release-please-manifest.json) and tags like vX.Y.Z.
set -euo pipefail

BASE_BRANCH="${BASE_BRANCH:-main}"
OUTPUT="${GITHUB_OUTPUT:-/dev/stdout}"

pending="$(gh pr list --state merged --base "$BASE_BRANCH" --label "autorelease: pending" --json number --jq 'length')"
if [[ "$pending" == "0" ]]; then
  echo "No merged Release PR is waiting for its tag."
  echo "mirror=false" >> "$OUTPUT"
  exit 0
fi

VERSION="$(python3 -c "import json; print(json.load(open('.release-please-manifest.json'))['.'])")"
NOTE="apps/documentation/src/content/docs/releases/v${VERSION}.mdx"

# A label left behind after a release was published by hand must not hold main forever.
if gh release view "v${VERSION}" > /dev/null 2>&1; then
  echo "Release v${VERSION} already exists. Nothing to hold."
  echo "mirror=false" >> "$OUTPUT"
  exit 0
fi

if [[ -f "$NOTE" ]]; then
  echo "Found ${NOTE}. Release v${VERSION} can be published."
  echo "mirror=true" >> "$OUTPUT"
  exit 0
fi

if [[ "${REQUIRE_RELEASE_NOTE:-}" == "true" ]]; then
  echo "::error::Release v${VERSION} is held: ${NOTE} is missing on ${BASE_BRANCH}."
  echo "No tag, no GitHub Release and no images were created."
  echo "Add ${NOTE} through a pull request into ${BASE_BRANCH}."
  echo "Merging it starts this workflow again, and the release is published then."
  exit 1
fi

echo "::notice::${NOTE} is missing. Release v${VERSION} is published with the notes release-please generates."
echo "To hold a release until its note exists: gh variable set REQUIRE_RELEASE_NOTE --body true"
echo "mirror=false" >> "$OUTPUT"
