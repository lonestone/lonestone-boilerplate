import { z } from "zod";
import { extendApi } from "@anatine/zod-openapi";
import { paginatedSchema } from "@lonestone/validations/server";

// Schema for content items (text, image, video)
export const postContentSchema = extendApi(z.object({
  type: z.enum(["text", "image", "video"]),
  data: z.string(),
}), {
  title: "PostContentSchema",
  description: "Schema for content items (text, image, video)",
});

// ----------------------------
// Create/update post schemas //
// ----------------------------

// Schema for creating/updating a post
export const createPostSchema = extendApi(z.object({
  title: z.string().min(1),
  content: z.array(postContentSchema),
}), {
  title: "CreatePostSchema",
  description: "Schema for creating/updating a post",
});

// Response schemas for the API
export const createPostResponseSchema = extendApi(z.object({
  id: z.string().uuid(),
  slug: z.string().optional(),
}), {
  title: "CreatePostResponseSchema",
  description: "Response schema for creating a post",
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreatePostResponse = z.infer<typeof createPostResponseSchema>;

export const updatePostSchema = extendApi(z.object({
  title: z.string().min(1).optional(),
  content: z.array(postContentSchema).optional(),
}), {
  title: "UpdatePostSchema",
  description: "Schema for updating a post",
});

export const updatePostResponseSchema = extendApi(z.object({
  id: z.string().uuid(),
  slug: z.string().optional(),
}), {
  title: "UpdatePostResponseSchema",
  description: "Response schema for updating a post",
});

export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type UpdatePostResponse = z.infer<typeof updatePostResponseSchema>;

export const userPostSchema = extendApi(z.object({
  id: z.string().uuid(),
  slug: z.string().optional(),
  title: z.string(),
  content: z.array(postContentSchema),
  versions: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      createdAt: z.date(),
    })
  ),
  publishedAt: z.date(),
}), {
  title: "UserPostSchema",
  description: "Schema for a user's post",
});

export const userPostsSchema = extendApi(z.array(userPostSchema), {
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
  }),
  {
    title: "PublicPostSchema",
    description: "A public post",
  }
);

// Schema for a list of public posts
export const publicPostsSchema = extendApi(
  paginatedSchema(publicPostSchema),
  {
    title: "PublicPostsSchema",
    description: "A list of public posts",
  }
);

export type PublicPost = z.infer<typeof publicPostSchema>;
export type PublicPosts = z.infer<typeof publicPostsSchema>;
