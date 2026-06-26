import { postControllerGetUserPosts } from '@boilerstone/openapi-generator/client/sdk.gen'
import { EmptyState } from '@boilerstone/ui/components/app'
import { Button } from '@boilerstone/ui/components/primitives/button'
import { Input } from '@boilerstone/ui/components/primitives/input'
import { Skeleton } from '@boilerstone/ui/components/primitives/skeleton'
import { FilterRule } from '@lonestone/nzoth/client'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FileText, PlusCircle, SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { UserPostCard } from '@/features/examples/user-posts/user-post-card'

const PAGE_SIZE = 12

export default function PostsListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
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

  const { data: posts, isLoading } = useQuery({
    queryKey: ['posts', pageValue, searchValue],
    queryFn: async () => {
      const response = await postControllerGetUserPosts({
        query: {
          offset: (pageValue - 1) * PAGE_SIZE,
          pageSize: PAGE_SIZE,
          filter: searchValue ? [{ property: 'title', rule: FilterRule.LIKE, value: searchValue }] : [],
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
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <p className="mb-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            Content
          </p>
          <h1 className="font-sans text-3xl font-black tracking-tight text-foreground">
            {t('posts.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('posts.description')}</p>
        </div>
        <Button render={<Link to="/dashboard/posts/new" />}>
          <PlusCircle className="h-4 w-4" />
          {t('posts.createNew')}
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
        <Input
          placeholder={t('posts.searchPlaceholder')}
          value={searchValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {isLoading
        ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                // oxlint-disable-next-line react/no-array-index-key
                <div key={`skeleton-${i}`} className="border border-border rounded-lg overflow-hidden">
                  <Skeleton className="aspect-video w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )
        : posts && posts.data.length > 0
          ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {posts.data.map(post => (
                    <UserPostCard key={post.id} post={post} />
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('posts.showing')}
                    {' '}
                    <span className="font-medium text-foreground">
                      {(pageValue - 1) * PAGE_SIZE + 1}
                      {' '}
                      –
                      {' '}
                      {Math.min(pageValue * PAGE_SIZE, posts.meta.itemCount || 0)}
                    </span>
                    {' '}
                    {t('posts.of')}
                    {' '}
                    <span className="font-medium text-foreground">{posts.meta.itemCount}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pageValue - 1)}
                      disabled={pageValue <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t('posts.previous')}
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {pageValue}
                      {' '}
                      /
                      {' '}
                      {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pageValue + 1)}
                      disabled={pageValue >= totalPages}
                    >
                      {t('posts.next')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )
          : (
              <EmptyState
                icon={<FileText className="size-6 text-muted-foreground" />}
                title={searchValue ? 'No results found' : t('posts.noPosts')}
                description={
                  searchValue
                    ? `No posts match "${searchValue}". Try a different search.`
                    : 'Create your first post to get started.'
                }
                action={
                  !searchValue
                    ? {
                        label: t('posts.createNew'),
                        onClick: () => navigate('/dashboard/posts/new'),
                        variant: 'default',
                      }
                    : undefined
                }
                className="border border-border rounded-lg"
              />
            )}
    </div>
  )
}
