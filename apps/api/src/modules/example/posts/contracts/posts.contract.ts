import {
  createFilterQueryStringSchema,
  createPaginationQuerySchema,
  createSortingQueryStringSchema,
  paginatedSchema,
} from '@lonestone/nzoth/server'
import { z } from 'zod'

// 📖 See API Guidelines: Schema Definition Best Practices
// https://github.com/lonestone/lonestone-boilerplate/blob/main/docs/api-guidelines.md#schema-definition-best-practices

// Schema for content items (text, image, video)
export const postContentSchema
  = z.discriminatedUnion('type', [
    z.object({
      type: z.literal('text'),
      data: z.string(),
    }),
    z.object({
      type: z.literal('image'),
      data: z.string(),
    }),
    z.object({
      type: z.literal('video'),
      data: z.string(),
    }),
  ]).meta(
    {
      title: 'PostContentSchema',
      description: 'Schema for content items (text, image, video)',
    },
  )

export const enabledPostSortingKey = [
  'title',
  'createdAt',
] as const

export const postSortingSchema = createSortingQueryStringSchema(
  enabledPostSortingKey,
)

export type PostSorting = z.infer<typeof postSortingSchema>

export const enabledPostFilteringKeys = [
  'title',
] as const

export const postFilteringSchema = createFilterQueryStringSchema(
  enabledPostFilteringKeys,
)

export type PostFiltering = z.infer<typeof postFilteringSchema>

export const postPaginationSchema = createPaginationQuerySchema()

export type PostPagination = z.infer<typeof postPaginationSchema>

export const postVersionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  createdAt: z.date(),
}).meta({
  title: 'PostVersionSchema',
  description: 'Schema for a post version',
})

// ----------------------------
// Create/update post schemas //
// ----------------------------

// Schema for creating/updating a post
export const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.array(postContentSchema),
}).meta({
  title: 'CreatePostSchema',
  description: 'Schema for creating/updating a post',
})

export type CreatePostInput = z.infer<typeof createPostSchema>

export const updatePostSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.array(postContentSchema).optional(),
}).meta({
  title: 'UpdatePostSchema',
  description: 'Schema for updating a post',
})

export type UpdatePostInput = z.infer<typeof updatePostSchema>

export const userPostSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().nullish(),
  title: z.string(),
  content: z.array(postContentSchema),
  versions: z.array(postVersionSchema),
  publishedAt: z.date().nullish(),
  type: z.enum(['published', 'draft']),
  commentCount: z.number().optional(),
}).meta({
  title: 'UserPostSchema',
  description: 'Schema for a user\'s post',
})

export const userPostsSchema = paginatedSchema(userPostSchema.omit({
  content: true,
}).extend({
  contentPreview: postContentSchema,
})).meta({
  title: 'UserPostsSchema',
  description: 'Schema for a list of user\'s posts',
})

export type UserPost = z.infer<typeof userPostSchema>
export type UserPosts = z.infer<typeof userPostsSchema>

// -------------//
// Public posts //
// -------------//

// Schema for the public view of a post
export const publicPostSchema = z.object({
  title: z.string(),
  author: z.object({
    name: z.string(),
  }),
  content: z.array(postContentSchema),
  publishedAt: z.date(),
  slug: z.string().optional(),
  commentCount: z.number().optional(),
}).meta({
  title: 'PublicPostSchema',
  description: 'A public post',
})

// Schema for a list of public posts
export const publicPostsSchema = paginatedSchema(publicPostSchema.omit({
  content: true,
}).extend({
  contentPreview: postContentSchema,
  commentCount: z.number().optional(),
})).meta({
  title: 'PublicPostsSchema',
  description: 'A list of public posts',
})

export type PublicPost = z.infer<typeof publicPostSchema>
export type PublicPosts = z.infer<typeof publicPostsSchema>
