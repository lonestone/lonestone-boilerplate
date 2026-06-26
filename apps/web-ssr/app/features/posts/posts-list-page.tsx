import type { Route } from './+types/posts-list-page'
import { publicPostControllerGetPosts } from '@boilerstone/openapi-generator/client/sdk.gen'
import { EmptyState } from '@boilerstone/ui/components/app'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Button } from '@boilerstone/ui/components/primitives/button'
import { Input } from '@boilerstone/ui/components/primitives/input'
import { ChevronLeft, ChevronRight, Search, Tag, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import PostCard from './post-card'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const searchParams = new URLSearchParams(url.search)
  const search = searchParams.get('search') || ''
  const tag = searchParams.get('tag') || ''
  const page = Number.parseInt(searchParams.get('page') || '1')

  const filters: Array<{ property: 'title' | 'tag', rule: 'like' | 'eq', value: string }> = []
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

  const handleSearch = (value: string) => {
    setSearchValue(value)
    const newParams = new URLSearchParams(searchParams)
    if (value) {
      newParams.set('search', value)
    }
    else {
      newParams.delete('search')
    }
    newParams.set('page', '1')
    setSearchParams(newParams)
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

  const totalPages = useMemo(() => {
    if (!posts?.data?.meta.itemCount)
      return 0
    return Math.ceil(posts.data.meta.itemCount / 10)
  }, [posts])

  const postList = posts?.data?.data ?? []

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Blog Posts</h2>
        <p className="text-muted-foreground">
          Browse through our latest blog posts
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={searchValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {tag && (
          <div className="flex items-center gap-1">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <Badge variant="secondary" className="flex items-center gap-1">
              {tag}
              <button type="button" onClick={handleClearTag} className="ml-1 hover:opacity-70">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}
      </div>

      {postList.length === 0
        ? (
            <EmptyState
              icon={<Search className="h-6 w-6 text-muted-foreground" />}
              title="No posts found"
              description={tag ? `No posts with tag "${tag}".` : 'Try a different search term.'}
              action={tag ? { label: 'Clear tag filter', onClick: handleClearTag } : undefined}
            />
          )
        : (
            <>
              <div className="grid gap-4">
                {postList.map(post => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing
                  {' '}
                  {(page - 1) * 10 + 1}
                  {' '}
                  to
                  {' '}
                  {Math.min(page * 10, posts?.data?.meta.itemCount || 0)}
                  {' '}
                  of
                  {' '}
                  {posts?.data?.meta.itemCount}
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
            </>
          )}
    </div>
  )
}

export function meta() {
  return [
    {
      title: 'Posts',
    },
    {
      property: 'og:title',
      content: 'Posts',
    },
    {
      name: 'description',
      content: 'Posts page',
    },
  ]
}
