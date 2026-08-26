#!/usr/bin/env bash
# Configure GitHub merge settings for the contribution system (see github-repo-settings.md).
# Dry-run by default. Pass --apply to PATCH the repository. Does not change branch
# protection or store Dokploy secrets.

set -euo pipefail

apply=false

for arg in "$@"; do
  case "$arg" in
    --apply)
      apply=true
      ;;
    -h|--help)
      echo "Usage: $0 [--apply]"
      echo "  Default: print the gh api calls (dry run)."
      echo "  --apply: set squash-only merge, PR title+description as the squash message,"
      echo "           and create the no-intention label and staging/production"
      echo "           GitHub Environments if they are missing."
      echo "  Does not change branch protection or store Dokploy secrets."
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--apply]" >&2
      exit 1
      ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required. Install the GitHub CLI and authenticate." >&2
  exit 1
fi

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

echo "Repository: ${repo}"
echo "Squash merge only; default squash message = pull request title and description."
echo

run_or_print() {
  if [[ "${apply}" == true ]]; then
    "$@"
  else
    printf 'dry-run:'
    printf ' %q' "$@"
    printf '\n'
  fi
}

run_or_print gh api -X PATCH "repos/${repo}" \
  -F allow_merge_commit=false \
  -F allow_squash_merge=true \
  -F allow_rebase_merge=false \
  -F squash_merge_commit_title=PR_TITLE \
  -F squash_merge_commit_message=PR_BODY

echo
echo "Label no-intention (skip the migration-intention gate)."
if [[ "${apply}" == true ]]; then
  if gh api "repos/${repo}/labels/no-intention" >/dev/null 2>&1; then
    echo "Label no-intention already exists."
  else
    gh api -X POST "repos/${repo}/labels" \
      -f name='no-intention' \
      -f color='C5DEF5' \
      -f description='Skip the migration-intention gate'
    echo "Label no-intention created."
  fi
else
  printf 'dry-run: gh api -X POST repos/%s/labels -f name=no-intention ...\n' "${repo}"
fi

echo
echo "GitHub Environments staging and production (Promote workflow)."
for environment in staging production; do
  if [[ "${apply}" == true ]]; then
    if gh api "repos/${repo}/environments/${environment}" >/dev/null 2>&1; then
      echo "Environment ${environment} already exists."
    else
      gh api -X PUT "repos/${repo}/environments/${environment}" --input - <<<'{}' >/dev/null
      echo "Environment ${environment} created."
    fi
  else
    printf 'dry-run: gh api -X PUT repos/%s/environments/%s\n' "${repo}" "${environment}"
  fi
done

if [[ "${apply}" == true ]]; then
  echo
  echo "Merge settings updated."
else
  echo
  echo "No changes made. Re-run with --apply to PATCH the repository."
fi

echo
echo "Still do in the GitHub UI (see scripts/github-repo-settings.md):"
echo "  - Protect main; require checks \"PR title and description\", \"Intention gate\", \"Release note\", plus CI jobs"
echo "  - Do not enable merge commits or rebase merging"
echo "  - On Environments staging and production, add DOKPLOY_URL, DOKPLOY_API_KEY, DOKPLOY_APPLICATIONS"
