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
