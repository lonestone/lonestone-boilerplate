import type { CreateCommentSchema } from '@boilerstone/openapi-generator'
import {
  commentsControllerCreateComment,
  commentsControllerDeleteComment,
  commentsControllerGetCommentReplies,
  commentsControllerGetComments,
} from '@boilerstone/openapi-generator/client/sdk.gen'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const PAGE_SIZE = 10

// One place for every key. `all` is the prefix of every comment query.
export const commentKeys = {
  all: ['comments'] as const,
  list: (postId: string) => [...commentKeys.all, postId, 'list'] as const,
  replies: (postId: string, commentId: string) =>
    [...commentKeys.all, postId, 'replies', commentId] as const,
}

export function useComments(postId: string) {
  return useInfiniteQuery({
    queryKey: commentKeys.list(postId),
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await commentsControllerGetComments({
        path: { postSlug: postId },
        query: { offset: pageParam, pageSize: PAGE_SIZE },
        signal,
        throwOnError: true,
      })
      return data
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

export function useReplies(postId: string, commentId: string) {
  return useQuery({
    queryKey: commentKeys.replies(postId, commentId),
    queryFn: async ({ signal }) => {
      const { data } = await commentsControllerGetCommentReplies({
        path: { commentId, postSlug: postId },
        query: { offset: 0, pageSize: PAGE_SIZE },
        signal,
        throwOnError: true,
      })
      return data
    },
  })
}

// Mutation hooks only handle the cache. Return the promise so `isPending` stays true until the
// refetch is done.
export function useAddComment(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateCommentSchema & { parentId?: string }) => {
      const { data } = await commentsControllerCreateComment({
        path: { postSlug: postId },
        body,
        throwOnError: true,
      })
      return data
    },
    onSuccess: (comment) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) }),
        comment.parentId
          ? queryClient.invalidateQueries({
              queryKey: commentKeys.replies(postId, comment.parentId),
            })
          : undefined,
      ]),
  })
}

export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      await commentsControllerDeleteComment({
        path: { commentId, postSlug: postId },
        throwOnError: true,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) }),
  })
}
