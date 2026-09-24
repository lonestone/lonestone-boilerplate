import {
  createFilterQueryStringSchema,
  createPaginationQuerySchema,
  createSortingQueryStringSchema,
  paginatedSchema,
} from '@lonestone/nzoth/server'
import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'

// 📖 See API Guidelines: Schema Definition Best Practices
// https://github.com/lonestone/lonestone-boilerplate/blob/main/docs/api-guidelines.md#schema-definition-best-practices

// Schema for content items (text, image, video)
export const postContentSchema = z
  .discriminatedUnion('type', [
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
  ])
  .meta({
    title: 'PostContentSchema',
    description: 'Schema for content items (text, image, video)',
  })

export const enabledPostSortingKey = ['title', 'createdAt'] as const

export const postSortingSchema = createSortingQueryStringSchema(enabledPostSortingKey)

export type PostSorting = z.infer<typeof postSortingSchema>

export const enabledPostFilteringKeys = ['title', 'tag'] as const

export const postFilteringSchema = createFilterQueryStringSchema(enabledPostFilteringKeys)

export type PostFiltering = z.infer<typeof postFilteringSchema>

export const postPaginationSchema = createPaginationQuerySchema()

export type PostPagination = z.infer<typeof postPaginationSchema>

export const postVersionSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    createdAt: z.date(),
  })
  .meta({
    title: 'PostVersionSchema',
    description: 'Schema for a post version',
  })

export const tagSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
  })
  .meta({
    title: 'TagSchema',
    description: 'A tag attached to a post',
  })

export type Tag = z.infer<typeof tagSchema>

export const postIdSchema = z.uuid().meta({
  description: 'Post identifier',
})

export const postSlugSchema = z.string().min(1).meta({
  description: 'Public post slug',
})

export const postCoverImageSchema = z
  .object({
    filename: z.string(),
    mimeType: z.string(),
    size: z.number().int().nonnegative(),
  })
  .meta({
    title: 'PostCoverImageSchema',
    description: 'Public metadata for a post cover image. The storage key is never exposed.',
  })

export type PostCoverImage = z.infer<typeof postCoverImageSchema>

export const postContentListSchema = z.array(postContentSchema)
export const postTagNamesSchema = z.array(z.string())

export function parseJsonMultipartField<T>(
  raw: string | undefined,
  schema: z.ZodType<T>,
  field: string,
): T | undefined {
  if (raw === undefined) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new BadRequestException(`${field} must be valid JSON`)
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new BadRequestException(result.error.issues[0]?.message ?? `${field} is invalid`)
  }

  return result.data
}

// ----------------------------
// Create/update post schemas //
// ----------------------------

export const createPostSchema = z
  .object({
    title: z.string().min(1),
    content: z.string().min(1),
    tags: z.string().optional(),
  })
  .meta({
    title: 'CreatePostSchema',
    description: 'Multipart fields for creating a post. Send content and tags as JSON strings.',
  })

export type CreatePostMultipart = z.infer<typeof createPostSchema>

export interface CreatePostInput {
  title: string
  content: z.infer<typeof postContentListSchema>
  tags?: string[]
}

export function toCreatePostInput(body: CreatePostMultipart): CreatePostInput {
  const content = parseJsonMultipartField(body.content, postContentListSchema, 'content')
  if (!content) throw new BadRequestException('content is required')

  return {
    title: body.title,
    content,
    tags: parseJsonMultipartField(body.tags, postTagNamesSchema, 'tags'),
  }
}

export const updatePostSchema = z
  .object({
    title: z.string().min(1).optional(),
    content: z.string().optional(),
    tags: z.string().optional(),
  })
  .meta({
    title: 'UpdatePostSchema',
    description:
      'Multipart fields for updating a post. Omit coverImage to keep the current one. Send content and tags as JSON strings.',
  })

export type UpdatePostMultipart = z.infer<typeof updatePostSchema>

export interface UpdatePostInput {
  title?: string
  content?: z.infer<typeof postContentListSchema>
  tags?: string[]
}

export function toUpdatePostInput(body: UpdatePostMultipart): UpdatePostInput {
  return {
    title: body.title,
    content: parseJsonMultipartField(body.content, postContentListSchema, 'content'),
    tags: parseJsonMultipartField(body.tags, postTagNamesSchema, 'tags'),
  }
}

export const userPostSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string().nullish(),
    title: z.string(),
    content: z.array(postContentSchema),
    versions: z.array(postVersionSchema),
    publishedAt: z.date().nullish(),
    type: z.enum(['published', 'draft']),
    commentCount: z.number().optional(),
    coverImage: postCoverImageSchema.optional(),
    tags: z.array(tagSchema),
  })
  .meta({
    title: 'UserPostSchema',
    description: "Schema for a user's post",
  })

export const userPostsSchema = paginatedSchema(
  userPostSchema
    .omit({
      content: true,
    })
    .extend({
      contentPreview: postContentSchema,
    }),
).meta({
  title: 'UserPostsSchema',
  description: "Schema for a list of user's posts",
})

export type UserPost = z.infer<typeof userPostSchema>
export type UserPosts = z.infer<typeof userPostsSchema>

// -------------//
// Public posts //
// -------------//

// Schema for the public view of a post
export const publicPostSchema = z
  .object({
    title: z.string(),
    author: z.object({
      name: z.string(),
    }),
    content: z.array(postContentSchema),
    publishedAt: z.date(),
    slug: z.string().optional(),
    commentCount: z.number().optional(),
    coverImage: postCoverImageSchema.optional(),
    likesCount: z.number(),
    tags: z.array(tagSchema),
  })
  .meta({
    title: 'PublicPostSchema',
    description: 'A public post',
  })

// Schema for a list of public posts
export const publicPostsSchema = paginatedSchema(
  publicPostSchema
    .omit({
      content: true,
    })
    .extend({
      contentPreview: postContentSchema,
      commentCount: z.number().optional(),
    }),
).meta({
  title: 'PublicPostsSchema',
  description: 'A list of public posts',
})

export type PublicPost = z.infer<typeof publicPostSchema>
export type PublicPosts = z.infer<typeof publicPostsSchema>

// Schema for the author posts list (public)
export const publicAuthorPostsSchema = paginatedSchema(
  publicPostSchema
    .omit({
      content: true,
    })
    .extend({
      contentPreview: postContentSchema,
    }),
).meta({
  title: 'PublicAuthorPostsSchema',
  description: 'A list of posts from a specific author',
})

export type PublicAuthorPosts = z.infer<typeof publicAuthorPostsSchema>
