import { Injectable, NotFoundException } from '@nestjs/common'
import {
  PublicPost,
  PublicPosts,
  UserPost,
  UserPosts,
} from './contracts/posts.contract'
import { Content, Post, PostVersion } from './posts.entity'
import {
  PublicPostResult,
  PublicPostsResult,
  UserPostsResult,
} from './posts.service'

type PostContentItem = UserPost['content'][number]

// Mappers do not need to be injectable, if they don't need to use other services. This is for example purposes.
// This mapper is a particulary complex one, to show that mapping logic can be contrieved but should not reside in the service.
@Injectable()
export class PostsMapper {
  toUserPost(post: Post): UserPost {
    const versions = this.getSortedVersions(post)
    const latestVersion = versions.at(-1)

    return {
      id: post.id,
      slug: post.slug,
      title: latestVersion?.title ?? '',
      content: (latestVersion?.content ?? []) as PostContentItem[],
      versions: versions.map(version => ({
        id: version.id,
        title: version.title,
        createdAt: version.createdAt,
      })),
      publishedAt: post.publishedAt,
      type: this.computePostType(post, latestVersion),
    }
  }

  toUserPosts({ posts, total, pagination }: UserPostsResult): UserPosts {
    return {
      data: posts.map((post) => {
        const versions = this.getSortedVersions(post)
        const latestVersion = versions.at(-1)
        const contentPreview = this.findContentPreview(latestVersion?.content)

        return {
          ...this.toUserPost(post),
          contentPreview,
        }
      }),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
  }

  toPublicPost({ post, commentCount }: PublicPostResult): PublicPost {
    const latestVersion = this.getLatestPublishedVersion(post)

    return {
      title: latestVersion.title,
      author: {
        name: post.user.name,
      },
      content: (latestVersion.content ?? []) as PostContentItem[],
      publishedAt: post.publishedAt!,
      slug: post.slug,
      commentCount,
    }
  }

  toPublicPosts({
    posts,
    total,
    pagination,
    commentCountByPostId,
  }: PublicPostsResult): PublicPosts {
    return {
      data: posts.map((post) => {
        const latestVersion = this.getLatestPublishedVersion(post)

        return {
          title: latestVersion.title,
          publishedAt: post.publishedAt!,
          slug: post.slug,
          author: {
            name: post.user.name,
          },
          contentPreview: this.findContentPreview(latestVersion.content),
          commentCount: commentCountByPostId.get(post.id) ?? 0,
        }
      }),
      meta: {
        itemCount: total,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: pagination.offset + pagination.pageSize < total,
      },
    }
  }

  private getSortedVersions(post: Post): PostVersion[] {
    if (!post.versions.isInitialized())
      return []

    return [...post.versions.getItems()].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    )
  }

  private computePostType(
    post: Post,
    latestVersion?: PostVersion,
  ): UserPost['type'] {
    if (!latestVersion)
      return 'draft'

    const hasBeenPublished = Boolean(post.publishedAt)
    const hasDraftAfterPublication = hasBeenPublished
      && latestVersion.createdAt > post.publishedAt!

    return hasBeenPublished && !hasDraftAfterPublication
      ? 'published'
      : 'draft'
  }

  private findContentPreview(content?: Content[]): PostContentItem {
    const firstTextContent = content?.find(item => item.type === 'text')
    if (firstTextContent) {
      return firstTextContent as PostContentItem
    }

    return {
      type: 'text',
      data: '',
    }
  }

  private getLatestPublishedVersion(post: Post): PostVersion {
    const versions = this.getSortedVersions(post)
      .filter(version => version.createdAt <= post.publishedAt!)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())

    const latestVersion = versions[0]
    if (!latestVersion) {
      throw new NotFoundException(`No valid version found for post ${post.id}`)
    }

    return latestVersion
  }
}
