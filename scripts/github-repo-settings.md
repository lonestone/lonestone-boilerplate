# GitHub repository settings

These settings cannot live in code. They make the squash commit equal the pull request title plus the pull request description, so every merge path produces the same curated history.

Apply them once on a new consumer repository. From the repo root:

```bash
./scripts/configure-github-repo.sh --apply
```

The script defaults to a dry run (prints the API calls, changes nothing). `--apply` patches merge settings, creates the `no-intention` label if it is missing, and creates the `staging` and `production` GitHub Environments if they are missing. It does not mutate branch protection or store Dokploy secrets.

## Checklist

### Merge strategy

- [ ] Allow squash merging
- [ ] Disable merge commits
- [ ] Disable rebase merging
- [ ] Default squash commit message: **Pull request title and description**
  - Title source: `PR_TITLE`
  - Message source: `PR_BODY`

This last item is load-bearing. Without it, GitHub will not copy the curated description into `git log`.

### Labels

- [ ] `no-intention` — skip the migration-intention gate (boilerplate producer). Apply it on PRs that do not need a consumer-facing intention (refactors, boilerplate-internal CI).
- [ ] Release-please labels (`autorelease: pending`, …) are created by the Release Please workflow.

Create the gate label:

```bash
gh label create no-intention \
  --description "Skip the migration-intention gate" \
  --color C5DEF5
```

`./scripts/configure-github-repo.sh --apply` also creates it if it is missing.

### Branch protection on `main`

Require pull requests, and require these status checks to pass:

- [ ] `PR title and description` (workflow: **PR lint**)
- [ ] `Intention gate` (workflow: **Intention gate**) — boilerplate producer; skips successfully when `no-intention` or `autorelease: pending` is present
- [ ] `Release note` (workflow: **Release note**) — other PRs skip this check successfully
- [ ] Existing CI jobs (`Lint`, `Type Check`, `Build`, `Test`, …)

### Repository variables

- [ ] `REQUIRE_RELEASE_NOTE` — optional. Release notes are not enforced by default; set this variable to `true` to make the **Release note** check block a Release PR until `releases/vX.Y.Z.mdx` exists. The boilerplate repository sets it.

```bash
gh variable set REQUIRE_RELEASE_NOTE --body true
```

Do not apply branch protection blindly with the API on a repo that already has rules. Set it in the GitHub UI (Settings → Branches, or Rulesets) so you do not wipe existing rules.

Do not add a workflow that auto-merges the Release PR. Green checks are not consent to ship. A human merges that PR.

### GitHub Environments (Promote)

Used by `.github/workflows/promote.yml` once the project is versioned and Dokploy pulls GHCR images. The full walkthrough is on the [Release and versioning](../apps/documentation/src/content/docs/references/1_release_and_versionning.mdx) page.

- [ ] Environment `staging`
- [ ] Environment `production`

`./scripts/configure-github-repo.sh --apply` creates those two environments if they are missing. It does not store secrets.

On each environment, add:

- Secret `DOKPLOY_URL`
- Secret `DOKPLOY_API_KEY`
- Secret `DOKPLOY_APPLICATIONS` (`service:dokployApplicationId` map, for example `api:…,web-spa:…,web-ssr:…`)

Optional: add required reviewers on `production` so Promote waits for a second approval. Do not hook production to the `latest` image tag — staging and production would then move together.
