import type { Route } from './+types/posts-list-page'
import { publicPostControllerGetPosts } from '@boilerstone/openapi-generator/client/sdk.gen'
import { EmptyState } from '@boilerstone/ui/components/app/empty-state'
import { Page, PageBody, PageHeader } from '@boilerstone/ui/components/app/page'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Input } from '@boilerstone/ui/components/primitives/input'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@boilerstone/ui/components/primitives/pagination'
import { FileText, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import PostCard from './post-card'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const searchParams = new URLSearchParams(url.search)
  const search = searchParams.get('search') || ''
  const tag = searchParams.get('tag') || ''
  const page = Number.parseInt(searchParams.get('page') || '1')

  const filters: Array<{ property: 'title' | 'tag'; rule: 'like' | 'eq'; value: string }> = []
  if (search) {
    filters.push({ property: 'title', rule: 'like', value: search })
  }
  if (tag) {
    filters.push({ property: 'tag', rule: 'eq', value: tag })
  }

  const posts = await publicPostControllerGetPosts({
    query: {
      filter: filters,
      offset: (page - 1) * 10,
      pageSize: 10,
    },
  })

  if (posts.error) {
    throw posts.error
  }

  return {
    posts,
    search,
    tag,
    page,
  }
}

export default function PostsListPage({ loaderData }: Route.ComponentProps) {
  const { posts, search, tag, page } = loaderData
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchValue, setSearchValue] = useState(search || '')
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleSearch = (value: string) => {
    setSearchValue(value)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const newParams = new URLSearchParams(searchParams)
      if (value) {
        newParams.set('search', value)
      } else {
        newParams.delete('search')
      }
      newParams.set('page', '1')
      setSearchParams(newParams, { replace: true })
    }, 300)
  }

  const handleClearTag = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('tag')
    newParams.set('page', '1')
    setSearchParams(newParams)
  }

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
    if (!posts?.data?.meta.itemCount) return 0
    return Math.ceil(posts.data.meta.itemCount / 10)
  }, [posts])

  const postList = posts?.data?.data ?? []
  const itemCount = posts?.data?.meta.itemCount ?? 0

  return (
    <Page variant="band">
      <PageHeader
        eyebrow="All articles"
        title="The Journal"
        actions={
          itemCount > 0 ? (
            <span className="text-sm text-muted-foreground">
              {itemCount} {itemCount === 1 ? 'article' : 'articles'}
            </span>
          ) : null
        }
      />

      <PageBody>
        {/* Filters bar */}
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search articles…"
              value={searchValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          {tag && (
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2.5 py-1">
              <span className="text-xs text-muted-foreground">Tag:</span>
              <Badge variant="default" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={handleClearTag}
                  aria-label="Remove tag filter"
                  className="ml-0.5 rounded-full transition-opacity hover:opacity-70 focus-visible:outline-none"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}
        </div>

        {/* Posts list */}
        {postList.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6 text-muted-foreground" />}
            title={tag ? `No articles tagged "${tag}"` : 'No articles found'}
            description={
              tag
                ? 'Try clearing the tag filter or searching for something else.'
                : 'Try a different search term.'
            }
            action={tag ? { label: 'Clear tag filter', onClick: handleClearTag } : undefined}
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

export function meta() {
  return [
    { title: 'Journal — Lonestone' },
    { property: 'og:title', content: 'Journal — Lonestone' },
    {
      name: 'description',
      content: 'Engineering insights and product thinking from the Lonestone team.',
    },
  ]
}
