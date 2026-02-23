import { and, desc, eq, inArray, isNotNull, sql, SQL } from 'drizzle-orm'
import { Elysia } from 'elysia'
import slugify from 'slugify'
import { user } from 'src/modules/db/schemas/auth.schema'
import { dbModule } from '../../db/db.module'
import { comments } from '../../db/schemas/example/comments.schema'
import { posts, postVersions } from '../../db/schemas/example/posts.schema'
import {
  CreatePostInput,
  PublicPost,
  PublicPosts,
  UpdatePostInput,
  UserPost,
  UserPosts,
} from './contracts/posts.contract'

export const PostService = new Elysia({ name: 'Post.Service' })
  .use(dbModule)
  .derive({ as: 'scoped' }, ({ db }) => {
    const createPost = async (userId: string, data: CreatePostInput): Promise<UserPost> => {
      const userdata = await db.query.user.findFirst({ where: eq(user.id, userId) })
      if (!userdata)
        throw new Error('User not found')

      const [newPost] = await db.insert(posts).values({
        userId: userdata!.id,
      }).returning()

      const [newVersion] = await db.insert(postVersions).values({
        postId: newPost.id,
        title: data.title,
        content: data.content,
      }).returning()

      return {
        id: newPost.id,
        title: newVersion.title,
        content: newVersion.content ?? [],
        type: 'draft',
        publishedAt: newPost.publishedAt,
        slug: newPost.slug,
        versions: [
          {
            id: newVersion.id,
            title: newVersion.title,
            createdAt: newVersion.createdAt,
          },
        ],
      }
    }

    const updatePost = async (
      postId: string,
      userId: string,
      data: UpdatePostInput,
    ): Promise<UserPost> => {
      const post = await db.query.posts.findFirst({
        where: and(eq(posts.id, postId), eq(posts.userId, userId)),
        with: { versions: true },
      })
      if (!post)
        throw new Error('Post not found')

      const latestVersion = await db.query.postVersions.findFirst({
        where: eq(postVersions.postId, post.id),
        orderBy: [desc(postVersions.createdAt)],
      })
      if (!latestVersion)
        throw new Error('No version found')

      const shouldCreateNewVersion
        = post.publishedAt && post.publishedAt < latestVersion.createdAt

      if (shouldCreateNewVersion) {
        const [newVersion] = await db.insert(postVersions).values({
          postId: post.id,
          title: data.title ?? latestVersion.title,
          content: data.content ?? latestVersion.content,
        }).returning()

        return {
          id: post.id,
          title: newVersion.title,
          content: newVersion.content ?? [],
          type: 'published',
          publishedAt: post.publishedAt,
          versions: [
            {
              id: newVersion.id,
              title: newVersion.title,
              createdAt: newVersion.createdAt,
            },
          ],
        } satisfies UserPost
      }

      // Update the last version
      await db.update(postVersions)
        .set({
          title: data.title ?? latestVersion.title,
          content: data.content ?? latestVersion.content,
        })
        .where(eq(postVersions.id, latestVersion.id))

      const updatedVersion = await db.query.postVersions.findFirst({
        where: eq(postVersions.id, latestVersion.id),
      })

      return {
        id: post.id,
        title: updatedVersion!.title,
        content: updatedVersion!.content ?? [],
        type:
          post.publishedAt && post.publishedAt < updatedVersion!.createdAt
            ? 'published'
            : 'draft',
        publishedAt: post.publishedAt,
        versions: [
          {
            id: updatedVersion!.id,
            title: updatedVersion!.title,
            createdAt: updatedVersion!.createdAt,
          },
        ],
      } satisfies UserPost
    }

    const computeSlug = async (postId: string): Promise<string | undefined> => {
      const versions = await db.query.postVersions.findMany({
        where: eq(postVersions.postId, postId),
        orderBy: [desc(postVersions.createdAt)],
      })

      if (versions.length === 0)
        return

      const baseSlug = slugify(versions[0].title, {
        lower: true,
        strict: true,
      })
      const shortId = postId.substring(0, 8)
      return `${baseSlug}-${shortId}`
    }

    const publishPost = async (userId: string, postId: string) => {
      const post = await db.query.posts.findFirst({
        where: and(eq(posts.id, postId), eq(posts.userId, userId)),
        with: { versions: true },
      })
      if (!post)
        throw new Error('Post not found')

      const latestVersion = await db.query.postVersions.findFirst({
        where: eq(postVersions.postId, post.id),
        orderBy: [desc(postVersions.createdAt)],
      })
      if (!latestVersion)
        throw new Error('No version found')

      const now = new Date()
      if (latestVersion.createdAt > now) {
        throw new Error(
          'Cannot publish: latest version is newer than publication date',
        )
      }

      let slug: string | undefined = post.slug ?? undefined
      if (!post.publishedAt) {
        slug = await computeSlug(post.id)
      }

      await db.update(posts)
        .set({ publishedAt: now, slug })
        .where(eq(posts.id, post.id))

      return {
        id: post.id,
        title: latestVersion.title,
        content: latestVersion.content ?? [],
        type: 'published',
        publishedAt: now,
        slug,
        versions: [
          {
            id: latestVersion.id,
            title: latestVersion.title,
            createdAt: latestVersion.createdAt,
          },
        ],
      }
    }

    const unpublishPost = async (userId: string, postId: string) => {
      const post = await db.query.posts.findFirst({
        where: and(eq(posts.id, postId), eq(posts.userId, userId)),
      })
      if (!post)
        throw new Error('Post not found')

      await db.update(posts)
        .set({ publishedAt: null })
        .where(eq(posts.id, post.id))

      return { ...post, publishedAt: null }
    }

    const getUserPost = async (postId: string, userId: string): Promise<UserPost> => {
      const post = await db.query.posts.findFirst({
        where: and(eq(posts.id, postId), eq(posts.userId, userId)),
        with: { versions: true, user: true },
      })
      if (!post)
        throw new Error('Post not found')

      const latestVersion = post.versions[post.versions.length - 1]

      return {
        id: post.id,
        title: latestVersion.title,
        content: latestVersion.content ?? [],
        type:
          post.publishedAt && post.publishedAt < latestVersion.createdAt
            ? 'published'
            : 'draft',
        publishedAt: post.publishedAt,
        versions: post.versions.map(version => ({
          id: version.id,
          title: version.title,
          createdAt: version.createdAt,
        })),
      } satisfies UserPost
    }

    const getUserPosts = async (
      userId: string,
      pagination: { offset: number, pageSize: number },
      filter?: { property: string, value: unknown }[],
    ): Promise<UserPosts> => {
      const conditions: SQL[] = [eq(posts.userId, userId)]

      if (filter?.length) {
        filter.forEach((item: { property: string, value: unknown }) => {
          if (item.property === 'title') {
            // Title filter needs to be handled via subquery or join
            // For simplicity, we'll skip this for now
          }
        })
      }

      const where = and(...conditions)

      const postsData = await db.query.posts.findMany({
        where,
        with: { versions: true },
        orderBy: [desc(posts.createdAt)],
        limit: pagination.pageSize,
        offset: pagination.offset,
      })

      const [{ count: total }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(where)

      const data = await Promise.all(
        postsData.map(async (post) => {
          const latestVersion = post.versions[post.versions.length - 1]
          if (!latestVersion)
            throw new Error(`No version found for post ${post.id}`)

          return {
            publishedAt: post.publishedAt,
            title: latestVersion.title,
            slug: post.slug,
            id: post.id,
            versions: post.versions.map(version => ({
              id: version.id,
              title: version.title,
              createdAt: version.createdAt,
            })),
            type:
              post.publishedAt && post.publishedAt < latestVersion.createdAt
                ? 'published'
                : 'draft',
            content: latestVersion.content ?? [],
          } satisfies UserPost
        }),
      )

      return {
        data,
        meta: {
          itemCount: total,
          pageSize: pagination.pageSize,
          offset: pagination.offset,
          hasMore: pagination.offset + pagination.pageSize < total,
        },
      }
    }

    const getPublicPost = async (slug: string): Promise<PublicPost> => {
      const post = await db.query.posts.findFirst({
        where: and(eq(posts.slug, slug), isNotNull(posts.publishedAt)),
        with: { user: true },
      })

      if (!post)
        throw new Error('Post not found')

      const latestVersion = await db.query.postVersions.findFirst({
        where: and(
          eq(postVersions.postId, post.id),
          sql`${postVersions.createdAt} <= ${post.publishedAt}`,
        ),
        orderBy: [desc(postVersions.createdAt)],
      })

      if (!latestVersion)
        throw new Error('No valid version found')

      const [{ count: commentCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(eq(comments.postId, post.id))

      return {
        publishedAt: post.publishedAt!,
        title: latestVersion.title,
        content: latestVersion.content || [],
        author: {
          name: post.user.name,
        },
        slug: post.slug ?? undefined,
        commentCount,
      }
    }

    const getRandomPublicPost = async (): Promise<PublicPost> => {
      const [{ count: postsCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(isNotNull(posts.publishedAt))

      const randomIndex = Math.floor(Math.random() * postsCount)

      const randomPosts = await db.query.posts.findMany({
        where: isNotNull(posts.publishedAt),
        with: { user: true },
        orderBy: [desc(posts.createdAt)],
        offset: randomIndex,
        limit: 1,
      })

      if (!randomPosts[0]?.slug)
        throw new Error('No post found')

      // Call getPublicPost logic inline
      const post = await db.query.posts.findFirst({
        where: and(eq(posts.slug, randomPosts[0].slug), isNotNull(posts.publishedAt)),
        with: { user: true },
      })

      if (!post)
        throw new Error('Post not found')

      const latestVersion = await db.query.postVersions.findFirst({
        where: and(
          eq(postVersions.postId, post.id),
          sql`${postVersions.createdAt} <= ${post.publishedAt}`,
        ),
        orderBy: [desc(postVersions.createdAt)],
      })

      if (!latestVersion)
        throw new Error('No valid version found')

      const [{ count: commentCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(eq(comments.postId, post.id))

      return {
        publishedAt: post.publishedAt!,
        title: latestVersion.title,
        content: latestVersion.content || [],
        author: {
          name: post.user.name,
        },
        slug: post.slug ?? undefined,
        commentCount,
      }
    }

    const getPublicPosts = async (
      pagination: { offset: number, pageSize: number },
      filter?: { property: string, value: unknown }[],
    ): Promise<PublicPosts> => {
      const conditions: SQL[] = [isNotNull(posts.publishedAt)]

      if (filter?.length) {
        filter.forEach((item: { property: string, value: unknown }) => {
          if (item.property === 'title') {
            // Title filter handled separately
          }
        })
      }

      const where = and(...conditions)

      const postsData = await db.query.posts.findMany({
        where,
        with: { user: true },
        orderBy: [desc(posts.publishedAt)],
        limit: pagination.pageSize,
        offset: pagination.offset,
      })

      const [{ count: total }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(where)

      const postIds = postsData.map(p => p.id)

      const allVersions = await db.query.postVersions.findMany({
        where: inArray(postVersions.postId, postIds),
        orderBy: [desc(postVersions.createdAt)],
      })

      const versionsByPost = new Map<string, typeof allVersions>()
      allVersions.forEach((version) => {
        const postId = version.postId
        if (!versionsByPost.has(postId)) {
          versionsByPost.set(postId, [])
        }
        versionsByPost.get(postId)!.push(version)
      })

      const commentCountsPromises = postsData.map(post =>
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(comments)
          .where(eq(comments.postId, post.id)),
      )
      const commentCounts = await Promise.all(commentCountsPromises)
      const commentCountByPostId = new Map<string, number>()
      postsData.forEach((post, index) => {
        commentCountByPostId.set(post.id, commentCounts[index][0].count)
      })

      const data = postsData.map((post) => {
        const versions = versionsByPost.get(post.id) || []
        const validVersions = versions.filter(
          v => v.createdAt <= post.publishedAt!,
        )
        const latestVersion = validVersions[0]

        if (!latestVersion) {
          throw new Error(`No valid version found for post ${post.id}`)
        }

        const contentPreview = latestVersion.content?.find(
          c => c.type === 'text',
        ) || { type: 'text' as const, data: '' }

        return {
          title: latestVersion.title,
          publishedAt: post.publishedAt!,
          slug: post.slug ?? undefined,
          author: {
            name: post.user.name,
          },
          contentPreview,
          commentCount: commentCountByPostId.get(post.id) || 0,
        }
      })

      return {
        data,
        meta: {
          itemCount: total,
          pageSize: pagination.pageSize,
          offset: pagination.offset,
          hasMore: pagination.offset + pagination.pageSize < total,
        },
      }
    }

    return {
      postService: {
        createPost,
        updatePost,
        publishPost,
        unpublishPost,
        getUserPost,
        getUserPosts,
        getPublicPost,
        getRandomPublicPost,
        getPublicPosts,
      },
    }
  })
