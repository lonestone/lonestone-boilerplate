# Unreleased migration intentions

Write one `slug.md` here in the **same pull request** as the code change. Copy [TEMPLATE.md](../TEMPLATE.md). There is no `NN-` prefix yet. The frontmatter `id:` is `unreleased/slug`.

At release time these files move into `vX.Y.Z/` with an `NN-` execution-order prefix, and ids are rewritten to `vX.Y.Z/slug` (`pnpm boilerplate intentions promote --to X.Y.Z`).

Optional `pr:` frontmatter records the pull request number.

PRs that do not need a consumer-facing intention (refactors, boilerplate-internal CI) take the `no-intention` label instead.
