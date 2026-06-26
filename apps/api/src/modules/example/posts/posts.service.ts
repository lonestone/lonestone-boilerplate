import { EntityManager, FilterQuery } from '@mikro-orm/core'
import { Injectable, NotFoundException } from '@nestjs/common'
import slugify from 'slugify'
import { User } from '../../auth/auth.entity'
import { buildOrderBy } from '../../db/query-order.util'
import { Comment } from '../../example/comments/comments.entity'
import {
  CreatePostInput,
  PostFiltering,
  PostPagination,
  PostSorting,
  UpdatePostInput,
} from './contracts/posts.contract'
import { Tag } from '../tags/tag.entity'
import { Post, PostVersion } from './posts.entity'

export interface UserPostsResult {
  posts: Post[]
  total: number
  pagination: PostPagination
}

export interface PublicPostResult {
  post: Post
  commentCount: number
}

export interface PublicPostsResult {
  posts: Post[]
  total: number
  pagination: PostPagination
  commentCountByPostId: Map<string, number>
}

export interface PublicAuthorPostsResult {
  posts: Post[]
  total: number
  pagination: PostPagination
  commentCountByPostId: Map<string, number>
}

@Injectable()
export class PostService {
  constructor(private readonly em: EntityManager) {}

  // Find existing tags by slug or create them on the fly (used by create/update).
  private async resolveTags(names: string[]): Promise<Tag[]> {
    const tags: Tag[] = []
    for (const name of names) {
      const slug = slugify(name, { lower: true, strict: true })
      let tag = await this.em.findOne(Tag, { slug })
      if (!tag) {
        tag = new Tag()
        tag.name = name
        tag.slug = slug
        this.em.persist(tag)
      }
      tags.push(tag)
    }
    return tags
  }

  async createPost(userId: string, data: CreatePostInput): Promise<Post> {
    const user = await this.em.findOne(User, { id: userId })
    if (!user)
      throw new Error('User not found')

    const post = new Post()
    post.user = user

    const version = new PostVersion()
    version.post = post
    version.title = data.title
    version.content = data.content
    post.versions.add(version)

    post.coverImage = data.coverImage
    if (data.tags)
      post.tags.set(await this.resolveTags(data.tags))

    this.em.persist([post, version])
    await this.em.flush()
    return post
  }

  async updatePost(
    postId: string,
    userId: string,
    data: UpdatePostInput,
  ): Promise<Post> {
    const post = await this.em.findOne(
      Post,
      { id: postId, user: userId },
      { populate: ['versions', 'tags'] },
    )
    if (!post)
      throw new Error('Post not found')

    const latestVersion = await this.em.findOne(
      PostVersion,
      { post: post.id },
      {
        orderBy: { createdAt: 'DESC' },
      },
    )
    if (!latestVersion)
      throw new Error('No version found')

    // We create a new version only if the post is published and the last version
    // was created before the publication
    const shouldCreateNewVersion
      = post.publishedAt && post.publishedAt < latestVersion.createdAt

    if (shouldCreateNewVersion) {
      const version = new PostVersion()
      version.post = post
      version.title = data.title ?? latestVersion.title
      version.content = data.content ?? latestVersion.content
      post.versions.add(version)
      this.em.persist(version)
      await this.em.flush()
    }
    else {
      // Otherwise we update the last version
      if (data.title)
        latestVersion.title = data.title
      if (data.content)
        latestVersion.content = data.content
      await this.em.flush()
    }

    if (data.coverImage !== undefined)
      post.coverImage = data.coverImage
    if (data.tags)
      post.tags.set(await this.resolveTags(data.tags))
    await this.em.flush()

    return post
  }

  async computeSlug(post: Post) {
    if (post.versions.length === 0)
      return

    const baseSlug = slugify(post.versions.getItems()[0].title, {
      lower: true,
      strict: true,
    })
    const shortId = post.id.substring(0, 8)
    return `${baseSlug}-${shortId}`
  }

  async publishPost(userId: string, postId: string): Promise<Post> {
    const post = await this.em.findOne(
      Post,
      { id: postId, user: userId },
      { populate: ['versions', 'tags'] },
    )
    if (!post)
      throw new Error('Post not found')

    const latestVersion = await this.em.findOne(
      PostVersion,
      { post: post.id },
      {
        orderBy: { createdAt: 'DESC' },
      },
    )
    if (!latestVersion)
      throw new Error('No version found')

    const now = new Date()
    // We check that the last version is older than the publication date
    if (latestVersion.createdAt > now) {
      throw new Error(
        'Cannot publish: latest version is newer than publication date',
      )
    }

    if (!post.publishedAt) {
      post.slug = await this.computeSlug(post)
    }

    post.publishedAt = now

    await this.em.flush()

    return post
  }

  async unpublishPost(userId: string, postId: string): Promise<Post> {
    const post = await this.em.findOne(
      Post,
      { id: postId, user: userId },
      { populate: ['versions', 'tags'] },
    )
    if (!post)
      throw new Error('Post not found')

    post.publishedAt = undefined
    await this.em.flush()
    return post
  }

  async getUserPost(postId: string, userId: string): Promise<Post> {
    const post = await this.em.findOne(
      Post,
      { id: postId, user: userId },
      {
        populate: ['versions', 'user'],
      },
    )
    if (!post)
      throw new Error('Post not found')

    return post
  }

  async getUserPosts(
    userId: string,
    pagination: PostPagination,
    sort?: PostSorting,
    filter?: PostFiltering,
  ): Promise<UserPostsResult> {
    const where: FilterQuery<Post> = { user: userId }
    const orderBy = buildOrderBy({
      sort,
      allowedProperties: ['createdAt'] as const,
      defaultProperty: 'createdAt',
    })

    if (filter?.length) {
      filter.forEach((item) => {
        if (item.property === 'title') {
          where.versions = { title: { $like: `%${item.value}%` } }
        }
      })
    }

    const [posts, total] = await this.em.findAndCount(Post, where, {
      populate: ['versions'],
      orderBy,
      limit: pagination.pageSize,
      offset: pagination.offset,
    })

    return {
      posts,
      total,
      pagination,
    }
  }

  async getRandomPublicPost(): Promise<PublicPostResult> {
    const postsCount = await this.em.count(Post, {
      publishedAt: { $ne: null },
    })
    if (postsCount === 0)
      throw new NotFoundException('No post found')

    const randomIndex = Math.floor(Math.random() * postsCount)
    const posts = await this.em.find(
      Post,
      { publishedAt: { $ne: null } },
      {
        populate: ['user', 'versions', 'tags'],
        orderBy: { createdAt: 'DESC' },
        offset: randomIndex,
        limit: 1,
      },
    )

    const randomPost = posts[0]
    if (!randomPost?.slug)
      throw new NotFoundException('No post found')

    const commentCount = await this.em.count(Comment, { post: randomPost.id })

    return {
      post: randomPost,
      commentCount,
    }
  }

  async getPublicPosts(
    pagination: PostPagination,
    sort?: PostSorting,
    filter?: PostFiltering,
  ): Promise<PublicPostsResult> {
    const where: FilterQuery<Post> = { publishedAt: { $ne: null } }
    const orderBy = buildOrderBy({
      sort,
      allowedProperties: ['publishedAt', 'createdAt'] as const,
      defaultProperty: 'publishedAt',
      stableProperty: 'createdAt',
    })

    if (filter?.length) {
      filter.forEach((item) => {
        if (item.property === 'title') {
          where.versions = { title: { $like: `%${item.value}%` } }
        }
        if (item.property === 'tag') {
          where.tags = { $or: [{ slug: item.value }, { name: item.value }] }
        }
      })
    }

    const [posts, total] = await this.em.findAndCount(Post, where, {
      populate: ['user', 'versions', 'tags'],
      orderBy,
      limit: pagination.pageSize,
      offset: pagination.offset,
    })

    const commentCountsPromises = posts.map(post =>
      this.em.count(Comment, { post: post.id }),
    )
    const commentCounts = await Promise.all(commentCountsPromises)
    const commentCountByPostId = new Map<string, number>()
    posts.forEach((post, index) => {
      commentCountByPostId.set(post.id, commentCounts[index])
    })

    return {
      posts,
      total,
      pagination,
      commentCountByPostId,
    }
  }

  async getPublicPostsByAuthor(
    authorSlug: string,
    pagination: PostPagination,
    sort?: PostSorting,
  ): Promise<PublicAuthorPostsResult> {
    const author = await this.em.findOne(User, { name: authorSlug })
    if (!author)
      throw new NotFoundException(`Author not found: ${authorSlug}`)

    const orderBy = buildOrderBy({
      sort,
      allowedProperties: ['publishedAt', 'createdAt'] as const,
      defaultProperty: 'publishedAt',
      stableProperty: 'createdAt',
    })

    const where: FilterQuery<Post> = {
      user: author.id,
      publishedAt: { $ne: null },
    }

    const [posts, total] = await this.em.findAndCount(Post, where, {
      populate: ['user', 'versions', 'tags'],
      orderBy,
      limit: pagination.pageSize,
      offset: pagination.offset,
    })

    const commentCountsPromises = posts.map(post =>
      this.em.count(Comment, { post: post.id }),
    )
    const commentCounts = await Promise.all(commentCountsPromises)
    const commentCountByPostId = new Map<string, number>()
    posts.forEach((post, index) => {
      commentCountByPostId.set(post.id, commentCounts[index])
    })

    return { posts, total, pagination, commentCountByPostId }
  }

  async likePost(slug: string): Promise<Post> {
    const post = await this.em.findOne(Post, {
      slug,
      publishedAt: { $ne: null },
    })

    if (!post)
      throw new NotFoundException(`Post not found: ${slug}`)

    post.likesCount += 1
    await this.em.flush()

    return post
  }

  async getPublicPost(slug: string): Promise<PublicPostResult> {
    const post = await this.em.findOne(
      Post,
      { slug, publishedAt: { $ne: null } },
      {
        populate: ['user', 'versions', 'tags'],
      },
    )

    if (!post)
      throw new Error('Post not found')

    const commentCount = await this.em.count(Comment, {
      post: post.id,
    })

    return {
      post,
      commentCount,
    }
  }
}
