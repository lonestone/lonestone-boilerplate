import { z } from 'zod'

// Schema for creating a comment
export const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().uuid().optional(),
}).meta({
  title: 'CreateCommentSchema',
  description: 'Schema for creating a comment',
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>

// Schema for comment response
// Using a simpler approach to avoid recursive type issues
export const commentSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  authorName: z.string().nullable(),
  createdAt: z.date(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).nullable(),
  parentId: z.string().uuid().nullable(),
  // For replies, we'll just include the IDs in the base schema
  // and load the full replies separately when needed
  replyIds: z.array(z.string().uuid()).optional(),
  replyCount: z.number().optional(),
}).meta({
  title: 'CommentSchema',
  description: 'Schema for a comment',
})

export type CommentResponse = z.infer<typeof commentSchema>

// Schema for comments list
export const commentsSchema = z.object({
  data: z.array(commentSchema),
  meta: z.object({
    itemCount: z.number(),
    pageSize: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
}).meta({
  title: 'CommentsSchema',
  description: 'Schema for a paginated list of comments',
})

export type CommentsResponse = z.infer<typeof commentsSchema>

// Sorting and filtering
export const enabledCommentSortingKey = [
  'createdAt',
  'authorName',
] as const

export const commentSortingSchema = z.object({
  sort: z.enum(enabledCommentSortingKey),
})

export type CommentSorting = z.infer<typeof commentSortingSchema>

export const enabledCommentFilteringKeys = [
  'content',
] as const

export const commentFilteringSchema = z.object({
  filter: z.enum(enabledCommentFilteringKeys),
})

export type CommentFiltering = z.infer<typeof commentFilteringSchema>

export const commentPaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
})

export type CommentPagination = z.infer<typeof commentPaginationSchema>
