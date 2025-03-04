import { z } from "zod";
import { extendApi } from "@anatine/zod-openapi";
import {
  createPaginationQuerySchema,
  FilterQueryStringSchema,
  paginatedSchema,
  SortingQueryStringSchema,
} from "@lonestone/validations/server";
import { Post, PostVersion } from "src/modules/posts/posts.entity";


// Schema for content items (text, image, video)
export const postContentSchema = extendApi(
  z.object({
    type: z.enum(["text", "image", "video"]),
    data: z.string(),
  }),
  {
    title: "PostContentSchema",
    description: "Schema for content items (text, image, video)",
  }
);

export const enabledPostSortingKey: (keyof Post | keyof PostVersion)[] = [
  "title",
  "createdAt",
] as const;

export const postSortingSchema = SortingQueryStringSchema(
  enabledPostSortingKey
);

export type PostSorting = z.infer<typeof postSortingSchema>;

export const enabledPostFilteringKeys = [
  "title",
] as const;

export const postFilteringSchema = FilterQueryStringSchema(
  enabledPostFilteringKeys
);

export type PostFiltering = z.infer<typeof postFilteringSchema>;

export const postPaginationSchema = createPaginationQuerySchema();

export type PostPagination = z.infer<typeof postPaginationSchema>;

export const postVersionSchema = extendApi(z.object({
  id: z.string().uuid(),
  title: z.string(),
  createdAt: z.date(),
}), {
  title: "PostVersionSchema",
  description: "Schema for a post version",
});


// ----------------------------
// Create/update post schemas //
// ----------------------------

// Schema for creating/updating a post
export const createPostSchema = extendApi(
  z.object({
    title: z.string().min(1),
    content: z.array(postContentSchema),
  }),
  {
    title: "CreatePostSchema",
    description: "Schema for creating/updating a post",
  }
);

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = extendApi(
  z.object({
    title: z.string().min(1).optional(),
    content: z.array(postContentSchema).optional(),
  }),
  {
    title: "UpdatePostSchema",
    description: "Schema for updating a post",
  }
);


export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const userPostSchema = extendApi(
  z.object({
    id: z.string().uuid(),
    slug: z.string().nullish(),
    title: z.string(),
    content: z.array(postContentSchema),
    versions: z.array(postVersionSchema),
    publishedAt: z.date().nullish(),
    type: z.enum(["published", "draft"]),
    commentCount: z.number().optional(),
  }),
  {
    title: "UserPostSchema",
    description: "Schema for a user's post",
  }
);

export const userPostsSchema = extendApi(paginatedSchema(userPostSchema.omit({
  content: true,
}).extend({
  contentPreview: postContentSchema,
})), {
  title: "UserPostsSchema",
  description: "Schema for a list of user's posts",
});

export type UserPost = z.infer<typeof userPostSchema>;
export type UserPosts = z.infer<typeof userPostsSchema>;

// -------------//
// Public posts //
// -------------//

// Schema for the public view of a post
export const publicPostSchema = extendApi(
  z.object({
    title: z.string(),
    author: z.object({
      name: z.string(),
    }),
    content: z.array(postContentSchema),
    publishedAt: z.date(),
    slug: z.string().optional(),
    commentCount: z.number().optional(),
  }),
  {
    title: "PublicPostSchema",
    description: "A public post",
  }
);

// Schema for a list of public posts
export const publicPostsSchema = extendApi(paginatedSchema(publicPostSchema.omit({
  content: true,
}).extend({
  contentPreview: postContentSchema,
  commentCount: z.number().optional(),
})), {
  title: "PublicPostsSchema",
  description: "A list of public posts",
});

export type PublicPost = z.infer<typeof publicPostSchema>;
export type PublicPosts = z.infer<typeof publicPostsSchema>;
