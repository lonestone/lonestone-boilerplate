import type { Route } from './+types/post-detail-page'
import { publicPostControllerGetPost, publicPostControllerLikePost } from '@boilerstone/openapi-generator/client/sdk.gen'
import PostContent from '@boilerstone/ui/components/posts/PostContent'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Button } from '@boilerstone/ui/components/primitives/button'
import { ArrowLeft, Calendar, Heart, Tag, User } from 'lucide-react'
import { Link, useFetcher, useSearchParams } from 'react-router'
import { CommentsList } from '../comments/comments-list'

export async function loader({ params }: { params: { slug: string } }) {
  const post = await publicPostControllerGetPost({
    path: {
      slug: params.slug,
    },
  })

  if (post.error) {
    throw post.error
  }

  return {
    post: post.data,
  }
}

export async function action({ params }: { params: { slug: string } }) {
  const result = await publicPostControllerLikePost({
    path: { slug: params.slug },
  })

  if (result.error) {
    throw result.error
  }

  return { post: result.data }
}

export default function PostPage({ loaderData }: Route.ComponentProps) {
  const postSlug = loaderData.post?.slug || ''
  const fetcher = useFetcher<typeof action>()
  const [searchParams] = useSearchParams()

  const likesCount = fetcher.data?.post?.likesCount ?? loaderData.post?.likesCount ?? 0
  const isLiking = fetcher.state !== 'idle'

  const activeTag = searchParams.get('tag')

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <Button variant="outline" render={<Link to="/posts" />}>
        <ArrowLeft className="h-4 w-4" />
        Back to posts
      </Button>

      {loaderData.post?.coverImage && (
        <div className="aspect-video overflow-hidden rounded-lg">
          <img
            src={loaderData.post.coverImage}
            alt={loaderData.post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <h1 className="text-4xl font-bold">{loaderData.post?.title}</h1>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {loaderData.post?.author && (
          <Link
            to={`/authors/${encodeURIComponent(loaderData.post.author.name)}`}
            className="flex items-center gap-2 hover:text-foreground transition-colors"
          >
            <User className="h-4 w-4" />
            <span>{loaderData.post.author.name}</span>
          </Link>
        )}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>
            {loaderData.post?.publishedAt
              ? new Date(loaderData.post.publishedAt).toLocaleDateString()
              : 'Date inconnue'}
          </span>
        </div>
        <fetcher.Form method="post">
          <button
            type="submit"
            disabled={isLiking}
            className="flex items-center gap-1 hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Heart className="h-4 w-4" />
            <span>{likesCount}</span>
          </button>
        </fetcher.Form>
      </div>

      {loaderData.post?.tags && loaderData.post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Tag className="h-4 w-4 text-muted-foreground self-center" />
          {loaderData.post.tags.map(tag => (
            <Badge
              key={tag.id}
              variant={activeTag === tag.slug ? 'default' : 'outline'}
              render={<Link to={`/posts?tag=${tag.slug}`} />}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {loaderData.post?.content && (
        <PostContent content={loaderData.post?.content} />
      )}

      {loaderData.post && (
        <CommentsList
          postId={postSlug}
          postAuthorId={loaderData.post.author.name}
        />
      )}
    </div>
  )
}

export function meta({ data }: Route.MetaArgs) {
  return [
    {
      title: data.post?.title,
    },
    {
      property: 'og:title',
      content: data.post?.title,
    },
    {
      name: 'description',
      content: data.post?.title,
    },
  ]
}
