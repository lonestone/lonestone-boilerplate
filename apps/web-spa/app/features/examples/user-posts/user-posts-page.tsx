import { EmptyState } from '@boilerstone/ui/components/app/empty-state'
import { PageHeader } from '@boilerstone/ui/components/app/page'
import { Button } from '@boilerstone/ui/components/primitives/button'
import { Input } from '@boilerstone/ui/components/primitives/input'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@boilerstone/ui/components/primitives/pagination'
import { Skeleton } from '@boilerstone/ui/components/primitives/skeleton'
import { motion, useReducedMotion } from 'motion/react'
import { FileText, PlusCircle, SearchIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { UserPostCard } from '@/features/examples/user-posts/user-post-card'
import { useUserPosts } from '@/features/examples/user-posts/hooks/use-user-posts'

const PAGE_SIZE = 12

export default function PostsListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchValue: string = searchParams.get('search') ?? ''
  const rawPage: number = Number(searchParams.get('page') ?? 1)
  const pageValue: number = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1
  const reduced = useReducedMotion()

  const handleSearch = (value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value) {
      newParams.set('search', value)
    } else {
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

  const pageQuery = (nextPage: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(nextPage))
    return next.toString()
  }

  const { data: posts, isLoading } = useUserPosts({
    page: pageValue,
    pageSize: PAGE_SIZE,
    search: searchValue,
  })

  const totalPages = useMemo(() => {
    if (!posts?.meta) return 0
    return Math.ceil(posts.meta.itemCount / PAGE_SIZE)
  }, [posts])

  return (
    <div className="space-y-8">
      {/* Page header */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <PageHeader
          variant="inset"
          eyebrow="Content"
          title={t('posts.title')}
          description={t('posts.description')}
          actions={
            <Button render={<Link to="/dashboard/posts/new" />}>
              <PlusCircle className="h-4 w-4" />
              {t('posts.createNew')}
            </Button>
          }
        />
      </motion.div>

      {/* Search bar */}
      <motion.div
        className="relative"
        initial={reduced ? false : { opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
      >
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
        <Input
          placeholder={t('posts.searchPlaceholder')}
          value={searchValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </motion.div>

      {/* Content */}
      {isLoading ? (
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
      ) : posts && posts.data.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.data.map((post, index) => (
              <motion.div
                key={post.id}
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.38,
                  ease: 'easeOut',
                  delay: index * 0.05,
                }}
              >
                <UserPostCard post={post} />
              </motion.div>
            ))}
          </div>

          {totalPages > 1 ? (
            <Pagination className="justify-between border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {t('posts.showing')}{' '}
                <span className="font-medium text-foreground">
                  {(pageValue - 1) * PAGE_SIZE + 1} –{' '}
                  {Math.min(pageValue * PAGE_SIZE, posts.meta.itemCount || 0)}
                </span>{' '}
                {t('posts.of')}{' '}
                <span className="font-medium text-foreground">{posts.meta.itemCount}</span>
              </p>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    text={t('posts.previous')}
                    href={pageValue > 1 ? `?${pageQuery(pageValue - 1)}` : undefined}
                    aria-disabled={pageValue <= 1 || undefined}
                    className={pageValue <= 1 ? 'pointer-events-none opacity-50' : undefined}
                    onClick={(event) => {
                      event.preventDefault()
                      if (pageValue > 1) handlePageChange(pageValue - 1)
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {pageValue} / {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    text={t('posts.next')}
                    href={pageValue < totalPages ? `?${pageQuery(pageValue + 1)}` : undefined}
                    aria-disabled={pageValue >= totalPages || undefined}
                    className={
                      pageValue >= totalPages ? 'pointer-events-none opacity-50' : undefined
                    }
                    onClick={(event) => {
                      event.preventDefault()
                      if (pageValue < totalPages) handlePageChange(pageValue + 1)
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={<FileText className="size-6 text-muted-foreground" />}
          title={searchValue ? t('posts.noResults') : t('posts.noPosts')}
          description={
            searchValue
              ? t('posts.noResultsDescription', { search: searchValue })
              : t('posts.emptyDescription')
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
