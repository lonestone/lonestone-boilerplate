import type { Route } from './+types/post-detail-page'
import { apiClient } from '@/lib/api-client'
import PostContent from '@lonestone/ui/components/posts/PostContent'
import { Button } from '@lonestone/ui/components/primitives/button'
import { ArrowLeft, Calendar, User } from 'lucide-react'
import { Link } from 'react-router'
import { CommentsList } from '../comments/comments-list'

export async function loader({ params }: { params: { slug: string } }) {
  const post = await apiClient.publicPostControllerGetPost({
    path: {
      slug: params.slug,
    },
  })

  return {
    post: post.data,
  }
}

export default function PostPage({ loaderData }: Route.ComponentProps) {
  // Get the post slug to use as a unique identifier for comments
  const postSlug = loaderData.post?.slug || ''

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <Button variant="outline" asChild>
        <Link to="/posts">
          <ArrowLeft className="h-4 w-4" />
          Back to posts
        </Link>
      </Button>
      <h1 className="text-4xl font-bold">{loaderData.post?.title}</h1>
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span>{loaderData.post?.author.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>
            {loaderData.post?.publishedAt
              ? new Date(loaderData.post.publishedAt).toLocaleDateString()
              : 'Date inconnue'}
          </span>
        </div>
      </div>

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
