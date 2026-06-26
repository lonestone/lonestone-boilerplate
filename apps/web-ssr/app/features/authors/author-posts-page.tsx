import type { Route } from './+types/author-posts-page'
import { publicAuthorControllerGetAuthorPosts } from '@boilerstone/openapi-generator/client/sdk.gen'
import { EmptyState } from '@boilerstone/ui/components/app'
import { Button } from '@boilerstone/ui/components/primitives/button'
import { ArrowLeft, ChevronLeft, ChevronRight, PenLine, User } from 'lucide-react'
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

  const totalPages = useMemo(() => {
    if (!itemCount) return 0
    return Math.ceil(itemCount / 10)
  }, [itemCount])

  const postList = authorPosts?.data ?? []

  return (
    <div>
      {/* Author header */}
      <div className="border-b border-border/60 bg-background">
        <div className="container mx-auto px-4 py-12 md:px-6 md:py-16">
          <Button
            variant="ghost"
            size="sm"
            render={<Link to="/posts" />}
            className="mb-8 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All articles
          </Button>

          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground md:h-16 md:w-16">
              <User className="h-7 w-7 md:h-8 md:w-8" />
            </div>

            <div>
              <p className="mb-0.5 text-xs font-medium tracking-widest text-muted-foreground uppercase">
                Author
              </p>
              <h1 className="mb-1 font-sans text-3xl font-black tracking-tight text-foreground md:text-4xl">
                {authorName}
              </h1>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <PenLine className="h-3.5 w-3.5" />
                {itemCount} {itemCount === 1 ? 'article' : 'articles'} published
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Posts list */}
      <div className="container mx-auto px-4 py-8 md:px-6 md:py-10">
        {postList.length === 0
          ? (
              <EmptyState
                icon={<User className="h-6 w-6 text-muted-foreground" />}
                title="No articles yet"
                description="This author hasn't published any articles yet."
                className="min-h-64 border border-dashed border-border rounded-none"
              />
            )
          : (
              <>
                <div className="flex flex-col gap-px border border-border bg-border">
                  {postList.map((post, index) => (
                    <PostCard key={post.slug} post={post} index={index} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {(page - 1) * 10 + 1}–{Math.min(page * 10, itemCount)} of {itemCount}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1}
                      >
                        <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                        Previous
                      </Button>
                      <span className="hidden text-xs text-muted-foreground sm:block">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
      </div>
    </div>
  )
}

export function meta({ data }: Route.MetaArgs) {
  const authorName = data.authorPosts?.data[0]?.author.name ?? data.authorSlug
  return [
    { title: `${authorName} — Lonestone Journal` },
    { property: 'og:title', content: `Articles by ${authorName}` },
    { name: 'description', content: `Browse articles written by ${authorName}.` },
  ]
}
