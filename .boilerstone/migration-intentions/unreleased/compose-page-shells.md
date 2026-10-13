---
id: unreleased/compose-page-shells
domain: frontend
classification: migration
---

# Compose screens from a page and a section

## Goal

A route layout writes its header, its main, and its footer. A screen uses `Page` and `PageHeader`. A block inside a screen uses `Section` and `SectionHeader`. A paged list composes `Pagination`. Pages do not copy the header markup, and they do not pass that chrome in as props.

## Why

The example apps copied the same chrome by hand. The SSR journal built the site header, the footer, and then a second title band on each page. The dashboard copied the same title row on each screen. The comments block under an article copied a third, smaller header, and its empty state did not use `EmptyState`. Projects that copied a page copied the markup too, so the next screen drifted.

`Header` and `Navigation` in the UI package were a config object (sections, items, variants) and nothing imported them. The route layout keeps the brand, the links, the theme, and the copy as elements. A shared shell that takes those blocks as props does not.

## Applies When

- The project tracks the `frontend` domain and has a web app that renders pages with a hand-written title row (eyebrow, `h1`, description) or a hand-written site header around an outlet.

## Do Not Apply When

- The project has no web app. Record as skipped.
- A human has explicitly decided to keep hand-written page headers after reviewing this intention. Record as skipped with that reason. A copied eyebrow-and-title block is **not** a skip condition.

## Observable Gaps

Search `apps/web-spa` and `apps/web-ssr` when those apps exist, otherwise the project's web app directories. Keep the project's own nav, copy, and routes.

1. **Page title** — signal: a screen file contains `tracking-widest` on an eyebrow above an `h1`, and it does not render `PageHeader`.
   Use `Page` with `PageHeader`. `band` is the public title (full-width, contained body). `inset` is the title row inside the signed-in app. `before`, `leading`, and `actions` are slots.
   Done when: the journal list, the author page, and the dashboard posts and profile screens render `PageHeader`, and `PageBody` holds the list.

2. **Section** — signal: a block inside a page renders its own `h2` plus a count, then a list or an empty card, and it does not render `SectionHeader`.
   Use `Section` and `SectionHeader`. Use `EmptyState` for the empty body. Leave the feature's query hooks in the feature.
   Done when: the comments list under an article renders `SectionHeader` and `EmptyState`.

3. **Pagination** — signal: a screen builds its own previous/next row (`ChevronLeft`, a range, `ChevronRight`) instead of composing `Pagination`.
   Compose `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationPrevious`, and `PaginationNext`. Keep the page number, the range, and the labels in the page.
   Done when: the journal list, the author page, and the dashboard posts list render that tree, and none of them imports `Pager`.

## Out of Scope

- The signed-in sidebar (`AppLayout` and the dashboard sidebar). It already is a shell.
- The auth split layout. It already composes.
- The home page and the article masthead. They are a landing and a long read, not a list frame.
- The AI page and the components gallery. Their headings are section headings inside a gallery, not the page title.
- Rewriting comment queries. They already live in the feature hook file.

## Reference Paths

- `packages/ui/src/components/app/page.tsx` — **adapt**
- `packages/ui/src/components/app/section.tsx` — **adapt**
- `packages/ui/src/components/primitives/pagination.tsx` — **adapt**
- `apps/web-ssr/app/features/posts/posts-list-page.tsx` — **adapt**
- `apps/web-ssr/app/features/authors/author-posts-page.tsx` — **adapt**
- `apps/web-ssr/app/features/comments/comments-list.tsx` — **adapt**
- `apps/web-spa/app/features/examples/user-posts/user-posts-page.tsx` — **adapt**

## Validation

- `pnpm typecheck` passes.
- The journal, the author page, and a dashboard screen show the same title treatment as before this change.
- The comments block is a section under the article, not a second page title.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/compose-page-shells --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
