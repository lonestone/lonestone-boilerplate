import type { CreateCommentSchema } from '@boilerstone/openapi-generator'
import {
  commentsControllerCreateComment,
  commentsControllerDeleteComment,
  commentsControllerGetComments,
} from '@boilerstone/openapi-generator/client/sdk.gen'
import type { QueryClient } from '@tanstack/react-query'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface CommentsQueryParams {
  postId: string
}

export function useCommentsQuery({ postId }: CommentsQueryParams) {
  return useInfiniteQuery({
    queryKey: ['comments', postId],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await commentsControllerGetComments({
        path: {
          postSlug: postId,
        },
        query: {
          offset: pageParam as number,
          pageSize: 10,
        },
      })

      if (res.error) {
        throw res.error
      }

      return res.data
    },
    getNextPageParam: (lastPage) => {
      if (
        lastPage?.meta?.hasMore &&
        lastPage.meta.offset + lastPage.meta.pageSize < lastPage.meta.itemCount
      ) {
        return lastPage.meta.offset + lastPage.meta.pageSize
      }
      return undefined
    },
    initialPageParam: 0,
  })
}

export function useAddComment({ postId }: CommentsQueryParams) {
  const queryClient: QueryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateCommentSchema & { parentId?: string }) => {
      const res = await commentsControllerCreateComment({
        body: data,
        path: {
          postSlug: postId,
        },
      })

      if (res.error) {
        throw res.error
      }

      return res
    },
    onSuccess: (result) => {
      // Invalidate comments query to refetch
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })

      if (result.data?.parentId) {
        queryClient.invalidateQueries({
          queryKey: ['replies', postId, result.data.parentId],
        })
      }
    },
  })
}

export function useDeleteComment({ postId }: CommentsQueryParams) {
  const queryClient: QueryClient = useQueryClient()

  return useMutation({
    mutationFn: async (commentId: string) => {
      const res = await commentsControllerDeleteComment({
        path: {
          commentId,
          postSlug: postId,
        },
      })

      if (res.error) {
        throw res.error
      }

      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] })
    },
    onError: (error) => {
      console.error('Error deleting comment:', error)
    },
  })
}
