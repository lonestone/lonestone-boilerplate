# GitHub Workflows

This folder contains the GitHub Actions workflows for the Lonestone project.

## Available workflows

### CI (Continuous Integration)

The CI workflow (`workflows/ci.yml`) runs on every push to `main`, and on pull requests targeting `main`.

It includes the following jobs:

#### Lint

- Checks the code with Oxlint.
- Command: `pnpm lint`

#### Knip

- Detects unused files and dependencies.
- Command: `pnpm knip`

#### Build

- Builds all packages and applications with `pnpm -r build`.
- Does not regenerate OpenAPI clients (that needs a running API).

#### Type Check

- Checks TypeScript types for all packages and applications with `pnpm -r run typecheck`.
- Runs after the build job; it does not run `pnpm generate` first.

#### Test

- Runs the workspace test suite with `pnpm test`.

#### Cost rules

GitHub bills each job in whole minutes, and a private repository has a monthly allowance. Three rules keep the bill down:

- A draft pull request gets no CI run. Marking it ready for review starts the run, and a push to a ready pull request runs it as usual. The `Setup` job is skipped and every other job needs it, so they are skipped too. A skipped job counts as a pass for a required check.
- A new push to a pull request cancels the run of the previous push. A run on `main` always finishes.
- The Release note job is skipped on a pull request that is not a Release PR, so no runner starts.

PR lint runs on every push, because a required check must report on every new commit. A project with no required check can drop `synchronize` from its `types` list: the script reads only the title and the description, and a push changes neither.

## Configuration

The workflow uses:

- Node.js 24.13.0
- pnpm 10.28.2
- Cache for pnpm dependencies
- Official actions for checkout, plus the local `setup-node-pnpm` composite action

## Adding a new workflow

To add a new workflow:

1. Create a new `.yml` file in the `workflows/` folder.
2. Define the events that trigger the workflow (push, pull_request, and so on).
3. Define the jobs and steps.
4. Commit and push the file.

## Resources

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)
