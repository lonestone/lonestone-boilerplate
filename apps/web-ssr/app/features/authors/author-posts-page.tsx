import type { Route } from './+types/author-posts-page'
import { publicAuthorControllerGetAuthorPosts } from '@boilerstone/openapi-generator/client/sdk.gen'
import { EmptyState } from '@boilerstone/ui/components/app/empty-state'
import { Page, PageBody, PageHeader } from '@boilerstone/ui/components/app/page'
import { Button } from '@boilerstone/ui/components/primitives/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@boilerstone/ui/components/primitives/pagination'
import { ArrowLeft, PenLine, User } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import PostCard from '../posts/post-card'

export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const page = Number.parseInt(url.searchParams.get('page') || '1')

  const result = await publicAuthorControllerGetAuthorPosts({
    path: { slug: params.slug },
    query: {
      offset: (page - 1) * 10,
      pageSize: 10,
    },
  })

  if (result.error) {
    throw result.error
  }

  return {
    authorSlug: params.slug,
    authorPosts: result.data,
    page,
  }
}

export default function AuthorPostsPage({ loaderData }: Route.ComponentProps) {
  const { authorSlug, authorPosts, page } = loaderData
  const [searchParams, setSearchParams] = useSearchParams()

  const authorName = authorPosts?.data[0]?.author.name ?? authorSlug
  const itemCount = authorPosts?.meta.itemCount ?? 0

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('page', newPage.toString())
    setSearchParams(newParams)
  }

  const pageQuery = (nextPage: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(nextPage))
    return next.toString()
  }

  const totalPages = useMemo(() => {
    if (!itemCount) return 0
    return Math.ceil(itemCount / 10)
  }, [itemCount])

  const postList = authorPosts?.data ?? []

  return (
    <Page variant="band">
      <PageHeader
        eyebrow="Author"
        title={authorName}
        before={
          <Button
            variant="ghost"
            size="sm"
            render={<Link to="/posts" />}
            className="mb-8 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All articles
          </Button>
        }
        leading={
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground md:h-16 md:w-16">
            <User className="h-7 w-7 md:h-8 md:w-8" />
          </div>
        }
        description={
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <PenLine className="h-3.5 w-3.5" />
            {itemCount} {itemCount === 1 ? 'article' : 'articles'} published
          </p>
        }
      />

      <PageBody>
        {postList.length === 0 ? (
          <EmptyState
            icon={<User className="h-6 w-6 text-muted-foreground" />}
            title="No articles yet"
            description="This author hasn't published any articles yet."
            className="min-h-64 border border-dashed border-border rounded-none"
          />
        ) : (
          <>
            <div className="flex flex-col gap-px border border-border bg-border">
              {postList.map((post, index) => (
                <PostCard key={post.slug} post={post} index={index} />
              ))}
            </div>

            {totalPages > 1 ? (
              <Pagination className="mt-8 justify-between">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {(page - 1) * 10 + 1}–{Math.min(page * 10, itemCount)} of {itemCount}
                </p>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      text="Previous"
                      href={page > 1 ? `?${pageQuery(page - 1)}` : undefined}
                      aria-disabled={page <= 1 || undefined}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
                      onClick={(event) => {
                        event.preventDefault()
                        if (page > 1) handlePageChange(page - 1)
                      }}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      Page {page} of {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      text="Next"
                      href={page < totalPages ? `?${pageQuery(page + 1)}` : undefined}
                      aria-disabled={page >= totalPages || undefined}
                      className={page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
                      onClick={(event) => {
                        event.preventDefault()
                        if (page < totalPages) handlePageChange(page + 1)
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </>
        )}
      </PageBody>
    </Page>
  )
}

export function meta({ loaderData }: Route.MetaArgs) {
  const authorName = loaderData.authorPosts?.data[0]?.author.name ?? loaderData.authorSlug
  return [
    { title: `${authorName} — Lonestone Journal` },
    { property: 'og:title', content: `Articles by ${authorName}` },
    { name: 'description', content: `Browse articles written by ${authorName}.` },
  ]
}
