# Contributing

This file is the source of truth for how we commit and how we merge. Read it before you commit or open a pull request.

Valid types and scopes live in [`commitlint.config.ts`](./commitlint.config.ts). Point to that file. Never copy the lists into docs, skills, or workflows.

## Commits

We follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). Every message looks like `type(scope): description`. A local git hook (lefthook) runs commitlint on the message. If it fails, the error tells you which rule broke; the allowed values are in `commitlint.config.ts`.

**WIP commits on your branch only need that format.** Half-steps, typo fixes, and "wip" subjects are fine. They will never land on `main` as commits. We squash. Their messages die with them unless you deliberately promote the *content* into the pull request description.

The subject says what changed. The **body** says why: the approach you took, what you rejected, and the constraint that drove it. Write a body whenever the commit makes a decision.

Never write the token `BREAKING-CHANGE:` unless you intend to force a major release. Release tooling matches that token anywhere in the message, even mid-sentence. If you do mean a major, use `type(scope)!: description` in the subject instead.

## Branches

Name branches loosely after the work, for example `feat/session-revocation` or `fix/pagination`. This is a convention, not a gate. With squash merge, the branch name never appears in history.

## Pull requests

This repository squash-merges every pull request. GitHub is configured so the squash commit is always **the pull request title plus the pull request description**. The GitHub button, `gh`, and auto-merge all produce that same commit, so there is nothing to compose at merge time. `CHANGELOG.md` is generated from those squash commits. Do not edit it by hand.

That makes the title and description the future history. Reviewers: read them as the `git log` entry that will land, and request wording changes the same way you request code changes.

### Title

The title becomes the squash subject. Write it as `type(scope): description`, with a scope from `commitlint.config.ts`. Keep it accurate from the first draft. CI lints it on every update, including drafts.

### Description

The description becomes the commit body, copied verbatim. When the pull request is ready to merge it must contain only:

1. **Rationale prose** — why this approach, what you rejected, what constraint drove it. Distill this from WIP commit bodies; do not concatenate them.
2. **One paragraph per additional consumer-visible change.** After a blank line, no bullet, written as a conventional header, for example `fix(api): correct off-by-one in list pagination`. Each one becomes its own changelog line and counts in the version. Use a valid type and scope from `commitlint.config.ts`.

Drop the rest of the WIP history. Subjects like "wip endpoint" or "fmt" describe the journey. The journey is over. The diff and the rationale describe the result.

**Screenshots, checklists, and review chatter go in comments**, never in the description. They would otherwise land in `git log`.

Draft pull requests may have an empty description. Finalization fills it in. A non-draft pull request must have a non-empty description.

Never write `BREAKING-CHANGE:` in the description unless you intend to force a major release.

### Finalize, then merge

When the work is ready, finalize the pull request (the `finalize-pr` skill does this on your machine):

1. Read the **full diff**, not the WIP commit subjects. Subjects under-describe the result.
2. Decide the consumer-visible changes this pull request lands.
3. Set the title to the primary change (a valid conventional header).
4. Write the description: rationale prose, then one unbulleted conventional paragraph per extra change. Drop everything else.
5. Scan for accidental `BREAKING-CHANGE:`.
6. Apply both with `gh pr edit`.

Do not merge as part of finalization. Once review and the PR lint check are green, anyone can merge from anywhere. GitHub appends `(#123)` to the subject: that is the durable link back to the pull request.

### Fixing a bad merged message

If a badly written message reaches `main` anyway, there is a correction tool that needs no git surgery: release-please honors a `BEGIN_COMMIT_OVERRIDE … END_COMMIT_OVERRIDE` block in the PR description, and it reads the description at parse time — so it works even **after** the merge. Edit the merged PR's description, put the corrected conventional message inside the block, and the Release PR recomputes.

This splits the git record from the parsed record, so it is an escape hatch, not a normal-flow tool. In normal flow, fix the description *before* merging.

## Repository settings

A new GitHub repository needs squash-only merges and the default squash message **pull request title and description**. That setting is load-bearing: without it, the title and description never become the commit.

Checklist and a one-command `gh` script: [`scripts/github-repo-settings.md`](./scripts/github-repo-settings.md).
