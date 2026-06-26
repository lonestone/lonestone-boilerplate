import type { Route } from './+types/author-posts-page'
import { publicAuthorControllerGetAuthorPosts } from '@boilerstone/openapi-generator/client/sdk.gen'
import { EmptyState } from '@boilerstone/ui/components/app'
import { Button } from '@boilerstone/ui/components/primitives/button'
import { ArrowLeft, ChevronLeft, ChevronRight, User } from 'lucide-react'
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

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('page', newPage.toString())
    setSearchParams(newParams)
  }

  const totalPages = useMemo(() => {
    if (!authorPosts?.meta.itemCount)
      return 0
    return Math.ceil(authorPosts.meta.itemCount / 10)
  }, [authorPosts])

  const postList = authorPosts?.data ?? []

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <Button variant="outline" render={<Link to="/posts" />}>
        <ArrowLeft className="h-4 w-4" />
        Back to posts
      </Button>

      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-muted">
          <User className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{authorName}</h1>
          <p className="text-muted-foreground">
            {authorPosts?.meta.itemCount ?? 0}
            {' '}
            {authorPosts?.meta.itemCount === 1 ? 'post' : 'posts'}
          </p>
        </div>
      </div>

      {postList.length === 0
        ? (
            <EmptyState
              icon={<User className="h-6 w-6 text-muted-foreground" />}
              title="No posts yet"
              description="This author hasn't published any posts."
            />
          )
        : (
            <>
              <div className="grid gap-4">
                {postList.map(post => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing
                    {' '}
                    {(page - 1) * 10 + 1}
                    {' '}
                    to
                    {' '}
                    {Math.min(page * 10, authorPosts?.meta.itemCount || 0)}
                    {' '}
                    of
                    {' '}
                    {authorPosts?.meta.itemCount}
                    {' '}
                    posts
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      Page
                      {' '}
                      {page}
                      {' '}
                      of
                      {' '}
                      {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
    </div>
  )
}

export function meta({ data }: Route.MetaArgs) {
  const authorName = data.authorPosts?.data[0]?.author.name ?? data.authorSlug
  return [
    { title: `Posts by ${authorName}` },
    { property: 'og:title', content: `Posts by ${authorName}` },
    { name: 'description', content: `Browse posts by ${authorName}` },
  ]
}
