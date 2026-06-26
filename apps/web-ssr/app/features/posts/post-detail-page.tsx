import type { Route } from './+types/post-detail-page'
import { publicPostControllerGetPost, publicPostControllerLikePost } from '@boilerstone/openapi-generator/client/sdk.gen'
import PostContent from '@boilerstone/ui/components/posts/PostContent'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Button } from '@boilerstone/ui/components/primitives/button'
import { ArrowLeft, Calendar, Heart, User } from 'lucide-react'
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
    <article>
      {/* Hero cover image */}
      {loaderData.post?.coverImage && (
        <div className="relative aspect-[21/9] w-full overflow-hidden bg-muted">
          <img
            src={loaderData.post.coverImage}
            alt={loaderData.post.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
        </div>
      )}

      {/* Article header */}
      <div className="border-b border-border/60">
        <div className="container mx-auto px-4 py-10 md:px-6 md:py-14">
          <Button
            variant="ghost"
            size="sm"
            render={<Link to="/posts" />}
            className="mb-8 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to journal
          </Button>

          {/* Tags */}
          {loaderData.post?.tags && loaderData.post.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {loaderData.post.tags.map(tag => (
                <Badge
                  key={tag.id}
                  variant={activeTag === tag.slug ? 'default' : 'outline'}
                  render={<Link to={`/posts?tag=${tag.slug}`} />}
                  className="cursor-pointer"
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="mb-6 max-w-3xl font-sans text-4xl font-black leading-[1.08] tracking-tight text-foreground md:text-5xl lg:text-6xl">
            {loaderData.post?.title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            {loaderData.post?.author && (
              <Link
                to={`/authors/${encodeURIComponent(loaderData.post.author.name)}`}
                className="flex items-center gap-2 font-medium text-foreground/80 transition-colors hover:text-foreground"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <User className="h-3.5 w-3.5" />
                </span>
                {loaderData.post.author.name}
              </Link>
            )}
            {loaderData.post?.publishedAt && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(loaderData.post.publishedAt).toLocaleDateString('en', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            )}
            <fetcher.Form method="post" className="flex items-center">
              <button
                type="submit"
                disabled={isLiking}
                className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-all hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Like this post (${likesCount} likes)`}
              >
                <Heart className="h-3.5 w-3.5 transition-colors group-hover:text-destructive" />
                <span className="tabular-nums">{likesCount}</span>
              </button>
            </fetcher.Form>
          </div>
        </div>
      </div>

      {/* Prose content */}
      <div className="container mx-auto px-4 md:px-6">
        <div className="mx-auto max-w-2xl py-12 md:py-16">
          {loaderData.post?.content && (
            <div className="prose prose-neutral dark:prose-invert max-w-none text-foreground leading-relaxed [&_p]:mb-4 [&_p]:text-base [&_p]:md:text-lg [&_img]:rounded-md [&_img]:my-6 [&_video]:rounded-md [&_video]:my-6">
              <PostContent content={loaderData.post.content} />
            </div>
          )}

          {/* End-of-article like CTA */}
          <div className="mt-12 flex flex-col items-center gap-4 border-t border-border pt-12">
            <p className="text-sm font-medium text-muted-foreground">
              Enjoyed this article?
            </p>
            <fetcher.Form method="post">
              <button
                type="submit"
                disabled={isLiking}
                className="group flex items-center gap-2 rounded-full border border-border bg-background px-6 py-2.5 text-sm font-medium text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Heart className="h-4 w-4 transition-colors group-hover:text-destructive" />
                <span>{isLiking ? 'Liking…' : `Like this post · ${likesCount}`}</span>
              </button>
            </fetcher.Form>
          </div>

          {/* Comments */}
          {loaderData.post && (
            <div className="mt-16">
              <CommentsList
                postId={postSlug}
                postAuthorId={loaderData.post.author.name}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: data.post?.title ? `${data.post.title} — Lonestone` : 'Article — Lonestone' },
    { property: 'og:title', content: data.post?.title },
    { name: 'description', content: data.post?.title },
  ]
}
