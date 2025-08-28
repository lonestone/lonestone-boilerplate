import type { Route } from './+types/posts-list-page'
import { publicPostControllerGetPosts } from '@lonestone/openapi-generator/client/sdk.gen'
import { Button } from '@lonestone/ui/components/primitives/button'
import { Input } from '@lonestone/ui/components/primitives/input'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import PostCard from './post-card'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const searchParams = new URLSearchParams(url.search)
  const search = searchParams.get('search') || ''
  const page = Number.parseInt(searchParams.get('page') || '1')

  const posts = await publicPostControllerGetPosts({
    query: {
      filter: search ? [{ property: 'title', rule: 'like', value: search }] : [],
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
    page,
  }
}

export default function PostsListPage({ loaderData }: Route.ComponentProps) {
  const { posts, search, page } = loaderData
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

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Blog Posts</h2>
        <p className="text-muted-foreground">
          Browse through our latest blog posts
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={searchValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {posts?.data?.data.map(post => (
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
