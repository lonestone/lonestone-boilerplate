import { postControllerGetUserPosts } from '@lonestone/openapi-generator'
import { queryOptions } from '@tanstack/react-query'
import '@/lib/api-client' // Configure API client with auth headers

export interface PostsQueryOptions {
  offset?: number
  pageSize?: number
}

/**
 * Query options for fetching user posts
 * @param options - Pagination options
 * @returns TanStack Query options for posts
 */
export function postsQueryOptions(options: PostsQueryOptions = {}) {
  const { offset = 0, pageSize = 20 } = options

  return queryOptions({
    queryKey: ['posts', offset, pageSize] as const,
    queryFn: async () => {
      const response = await postControllerGetUserPosts({
        query: { offset, pageSize },
      })

      if (response.error) {
        throw new Error('Failed to fetch posts')
      }

      return response.data
    },
  })
}

/**
 * Query key factory for posts
 */
export const postsKeys = {
  all: ['posts'] as const,
  lists: () => [...postsKeys.all, 'list'] as const,
  list: (offset: number, pageSize: number) => [...postsKeys.lists(), offset, pageSize] as const,
}
