import { postControllerGetUserPosts } from '@lonestone/openapi-generator/client/sdk.gen'
import { Button } from '@lonestone/ui/components/primitives/button'
import { Input } from '@lonestone/ui/components/primitives/input'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  PlusCircleIcon,
  SearchIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { UserPostCard } from '@/features/user-posts/user-post-card'

const PAGE_SIZE = 12

export default function PostsListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchValue, setSearchValue] = useState(
    searchParams.get('search') || '',
  )

  const [pageValue, setPageValue] = useState(1)

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
    setPageValue(newPage)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('page', newPage.toString())
    setSearchParams(newParams)
  }

  const { data: posts } = useQuery({
    queryKey: ['posts', pageValue, searchValue],
    queryFn: async () => {
      const response = await postControllerGetUserPosts({
        query: {
          offset: (pageValue - 1) * PAGE_SIZE,
          pageSize: PAGE_SIZE,
          filter: searchValue ? [{ property: 'title', rule: 'like', value: searchValue }] : [],
        },
      })

      if (response.error) {
        throw response.error
      }

      return response.data
    },
  })

  const totalPages = useMemo(() => {
    if (!posts?.meta)
      return 0
    return Math.ceil(posts.meta.itemCount / PAGE_SIZE)
  }, [posts])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Blog Posts</h2>
        <p className="text-muted-foreground">Browse through your blog posts</p>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-20" />
          <Input
            placeholder="Search posts..."
            value={searchValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      {posts && posts.data.length > 0
        ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {posts.data.map(post => (
                  <UserPostCard key={post.id} post={post} />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing
                  {' '}
                  {(pageValue - 1) * PAGE_SIZE + 1}
                  {' '}
                  to
                  {' '}
                  {Math.min(
                    pageValue * PAGE_SIZE,
                    posts.meta.itemCount || 0,
                  )}
                  {' '}
                  of
                  {' '}
                  {posts.meta.itemCount}
                  {' '}
                  posts
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pageValue - 1)}
                    disabled={pageValue <= 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Page
                    {' '}
                    {pageValue}
                    {' '}
                    of
                    {' '}
                    {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pageValue + 1)}
                    disabled={pageValue >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )
        : (
            <div className="space-y-2 ">
              <div className="text-muted-foreground">No posts found</div>
              <Button variant="outline" size="sm" asChild>
                <Link to="./posts/new">
                  <PlusCircleIcon className="h-4 w-4" />
                  Create a new post
                </Link>
              </Button>
            </div>
          )}
    </div>
  )
}
