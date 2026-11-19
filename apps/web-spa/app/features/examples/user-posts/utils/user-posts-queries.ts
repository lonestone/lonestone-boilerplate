import {
  postControllerRemoveCoverImage,
  postControllerSetCoverImage,
} from '@boilerstone/openapi-generator/client/sdk.gen'

/**
 * Query keys for the current user's posts.
 *
 * Every key starts with `postKeys.all`, so invalidating it refreshes
 * both the lists and the details after a mutation.
 */
export const postKeys = {
  all: ['userPosts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (page: number, search: string) => [...postKeys.lists(), { page, search }] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (id?: string) => [...postKeys.details(), id] as const,
}

/**
 * Applies a cover image change after the post itself is saved.
 * A file replaces the image, `null` removes it, `undefined` keeps it.
 */
export async function saveCoverImage(
  postId: string,
  coverImage: File | null | undefined,
): Promise<void> {
  if (coverImage === undefined) return

  const response = coverImage
    ? await postControllerSetCoverImage({ path: { id: postId }, body: { file: coverImage } })
    : await postControllerRemoveCoverImage({ path: { id: postId } })

  if (response.error) throw response.error
}
