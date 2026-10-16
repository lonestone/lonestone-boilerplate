import type { CreatePostSchema, UpdatePostSchema } from '@boilerstone/openapi-generator'
import {
  postControllerCreatePost,
  postControllerGetUserPost,
  postControllerGetUserPosts,
  postControllerPublishPost,
  postControllerUnpublishPost,
  postControllerUpdatePost,
} from '@boilerstone/openapi-generator/client/sdk.gen'
import { FilterRule } from '@lonestone/nzoth/client'
import type { QueryClient } from '@tanstack/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface UserPostsListParams {
  page: number
  pageSize: number
  search: string
}

// One place for every key. `lists()` is the prefix to invalidate when any list may be stale.
export const userPostKeys = {
  all: ['user-posts'] as const,
  lists: () => [...userPostKeys.all, 'list'] as const,
  list: (params: UserPostsListParams) => [...userPostKeys.lists(), params] as const,
  details: () => [...userPostKeys.all, 'detail'] as const,
  detail: (id: string) => [...userPostKeys.details(), id] as const,
}

export function useUserPosts(params: UserPostsListParams) {
  return useQuery({
    queryKey: userPostKeys.list(params),
    queryFn: async ({ signal }) => {
      const { data } = await postControllerGetUserPosts({
        query: {
          offset: (params.page - 1) * params.pageSize,
          pageSize: params.pageSize,
          filter: params.search
            ? [{ property: 'title', rule: FilterRule.LIKE, value: params.search }]
            : [],
        },
        signal,
        throwOnError: true,
      })
      return data
    },
  })
}

export function useUserPost(id: string) {
  return useQuery({
    queryKey: userPostKeys.detail(id),
    queryFn: async ({ signal }) => {
      const { data } = await postControllerGetUserPost({
        path: { id },
        signal,
        throwOnError: true,
      })
      return data
    },
  })
}

// Mutation hooks only handle the cache. Toasts and navigation belong to the caller.
// Returning the promise keeps `isPending` true until the refetch is done.
function invalidateLists(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: userPostKeys.lists() })
}

function invalidatePost(queryClient: QueryClient, id: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: userPostKeys.detail(id) }),
    invalidateLists(queryClient),
  ])
}

export function useCreateUserPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreatePostSchema) => {
      const { data } = await postControllerCreatePost({ body, throwOnError: true })
      return data
    },
    onSuccess: () => invalidateLists(queryClient),
  })
}

export function useUpdateUserPost(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpdatePostSchema) => {
      const { data } = await postControllerUpdatePost({ path: { id }, body, throwOnError: true })
      return data
    },
    onSuccess: () => invalidatePost(queryClient, id),
  })
}

export function usePublishUserPost(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await postControllerPublishPost({ path: { id }, throwOnError: true })
    },
    onSuccess: () => invalidatePost(queryClient, id),
  })
}

export function useUnpublishUserPost(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await postControllerUnpublishPost({ path: { id }, throwOnError: true })
    },
    onSuccess: () => invalidatePost(queryClient, id),
  })
}
