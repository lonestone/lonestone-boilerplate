import {
  createFilterQueryStringSchema,
  createPaginationQuerySchema,
  createSortingQueryStringSchema,
  paginatedSchema,
} from '@lonestone/nzoth/server'
import { z } from 'zod'

// Schema for creating a comment
export const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().uuid().optional(),
}).openapi({
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
}).openapi({
  title: 'CommentSchema',
  description: 'Schema for a comment',
})

export type CommentResponse = z.infer<typeof commentSchema>

// Schema for comments list
export const commentsSchema = paginatedSchema(commentSchema).openapi({
  title: 'CommentsSchema',
  description: 'Schema for a paginated list of comments',
})

export type CommentsResponse = z.infer<typeof commentsSchema>

// Sorting and filtering
export const enabledCommentSortingKey = [
  'createdAt',
  'authorName',
] as const

export const commentSortingSchema = createSortingQueryStringSchema(
  enabledCommentSortingKey,
)

export type CommentSorting = z.infer<typeof commentSortingSchema>

export const enabledCommentFilteringKeys = [
  'content',
] as const

export const commentFilteringSchema = createFilterQueryStringSchema(
  enabledCommentFilteringKeys,
)

export type CommentFiltering = z.infer<typeof commentFilteringSchema>

export const commentPaginationSchema = createPaginationQuerySchema()

export type CommentPagination = z.infer<typeof commentPaginationSchema>
