import type { Route } from './+types/post-detail-page'
import {
  publicPostControllerGetPost,
  publicPostControllerGetPosts,
  publicPostControllerLikePost,
} from '@boilerstone/openapi-generator/client/sdk.gen'
import PostContent from '@boilerstone/ui/components/posts/PostContent'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Button } from '@boilerstone/ui/components/primitives/button'
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react'
import { ArrowLeft, ArrowRight, Calendar, Clock, Heart, User } from 'lucide-react'
import { useState } from 'react'
import { Link, useFetcher, useSearchParams } from 'react-router'
import { CommentsList } from '../comments/comments-list'

// ── Read-time helper (~200 wpm) ─────────────────────────────────────────────
function estimateReadTime(content: unknown[] | null | undefined): number {
  if (!content) return 1
  const words = content
    .map((block: unknown) => {
      if (typeof block === 'object' && block !== null && 'data' in block) {
        const b = block as { type?: string; data?: string }
        return b.type === 'text' ? (b.data ?? '') : ''
      }
      return ''
    })
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

// ── Reading progress bar ────────────────────────────────────────────────────
function ReadingProgressBar() {
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 160,
    damping: 28,
    restDelta: 0.001,
  })

  if (reduced) return null

  return (
    <motion.div
      className="fixed left-0 top-0 z-[60] h-[3px] w-full origin-left bg-primary"
      style={{ scaleX }}
      aria-hidden="true"
    />
  )
}

// ── Related-post compact card ────────────────────────────────────────────────
interface RelatedCardProps {
  slug: string
  title: string
  authorName: string
  publishedAt: string
  coverImage?: string | null
  index: number
}

function RelatedCard({
  slug,
  title,
  authorName,
  publishedAt,
  coverImage,
  index,
}: RelatedCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const reduced = useReducedMotion()

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: 'easeOut', delay: index * 0.07 }}
    >
      <Link
        to={`/posts/${slug}`}
        viewTransition
        className="group flex gap-4 border border-border bg-background p-4 transition-all duration-200 hover:border-foreground/20 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
      >
        {/* Thumbnail */}
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-sm bg-muted">
          {coverImage && !imgError ? (
            <img
              src={coverImage}
              alt={title}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={[
                'h-full w-full object-cover transform-gpu transition-all duration-500 group-hover:scale-105',
                imgLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm',
              ].join(' ')}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="select-none font-sans text-lg font-black uppercase tracking-tight text-muted-foreground/20">
                {title.slice(0, 2)}
              </span>
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <p className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-foreground">
            {title}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{authorName}</span>
            <span aria-hidden="true">·</span>
            <span>
              {new Date(publishedAt).toLocaleDateString('en', { month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center self-center text-muted-foreground transition-colors group-hover:text-foreground">
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </Link>
    </motion.div>
  )
}

// ── Loader ───────────────────────────────────────────────────────────────────
export async function loader({ params }: { params: { slug: string } }) {
  const [postResult, relatedResult] = await Promise.all([
    publicPostControllerGetPost({ path: { slug: params.slug } }),
    publicPostControllerGetPosts({ query: { offset: 0, pageSize: 4, filter: [] } }).catch(
      () => null,
    ),
  ])

  if (postResult.error) {
    throw postResult.error
  }

  const allPosts = relatedResult?.data?.data ?? []
  const related = allPosts.filter((p) => p.slug !== params.slug).slice(0, 3)

  return {
    post: postResult.data,
    related,
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

// ── Page component ───────────────────────────────────────────────────────────
export default function PostPage({ loaderData }: Route.ComponentProps) {
  const { post, related } = loaderData
  const postSlug = post?.slug || ''
  const fetcher = useFetcher<typeof action>()
  const [searchParams] = useSearchParams()
  const [coverLoaded, setCoverLoaded] = useState(false)

  const likesCount = fetcher.data?.post?.likesCount ?? post?.likesCount ?? 0
  const isLiking = fetcher.state !== 'idle'
  const activeTag = searchParams.get('tag')
  const readTime = estimateReadTime(post?.content as unknown[] | null | undefined)

  return (
    <article>
      {/* Reading progress bar — fixed top */}
      <ReadingProgressBar />

      {/* Hero cover image */}
      {post?.coverImage && (
        <div className="relative aspect-[21/9] w-full overflow-hidden bg-muted">
          <img
            src={post.coverImage}
            alt={post.title}
            onLoad={() => setCoverLoaded(true)}
            className={[
              'h-full w-full object-cover transition-all duration-700',
              coverLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-md scale-[1.02]',
            ].join(' ')}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
          {/* Grain on hero image */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-grain opacity-[0.12] mix-blend-overlay"
          />
        </div>
      )}

      {/* Article header */}
      <div className="border-b border-border/60">
        <div className="container mx-auto px-4 py-10 md:px-6 md:py-14">
          <Button
            variant="ghost"
            size="sm"
            render={<Link to="/posts" viewTransition />}
            className="mb-8 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to journal
          </Button>

          {/* Tags */}
          {post?.tags && post.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={activeTag === tag.slug ? 'default' : 'outline'}
                  render={<Link to={`/posts?tag=${tag.slug}`} viewTransition />}
                  className="cursor-pointer"
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="mb-6 max-w-3xl font-sans text-4xl font-black leading-[1.08] tracking-tight text-foreground md:text-5xl lg:text-6xl">
            {post?.title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            {post?.author && (
              <Link
                to={`/authors/${encodeURIComponent(post.author.name)}`}
                viewTransition
                className="flex items-center gap-2 font-medium text-foreground/80 transition-colors hover:text-foreground"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <User className="h-3.5 w-3.5" />
                </span>
                {post.author.name}
              </Link>
            )}
            {post?.publishedAt && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(post.publishedAt).toLocaleDateString('en', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            )}
            {/* Estimated read time */}
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {readTime} min read
            </span>
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
          {post?.content && (
            <div
              className={[
                'prose prose-neutral dark:prose-invert max-w-none text-foreground leading-relaxed',
                // Paragraphs
                '[&_p]:mb-5 [&_p]:text-base [&_p]:md:text-lg [&_p]:leading-[1.8]',
                // Drop cap on first paragraph
                '[&_p:first-of-type::first-letter]:float-left [&_p:first-of-type::first-letter]:mr-2 [&_p:first-of-type::first-letter]:mt-0.5 [&_p:first-of-type::first-letter]:font-black [&_p:first-of-type::first-letter]:text-5xl [&_p:first-of-type::first-letter]:leading-[0.85] [&_p:first-of-type::first-letter]:text-foreground md:[&_p:first-of-type::first-letter]:text-6xl',
                // Images
                '[&_img]:rounded-md [&_img]:my-8 [&_img]:border [&_img]:border-border/60 [&_img]:shadow-sm',
                '[&_video]:rounded-md [&_video]:my-8',
                // Blockquote as pull-quote
                '[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-5 [&_blockquote]:py-1 [&_blockquote]:my-8 [&_blockquote]:not-italic',
                '[&_blockquote_p]:text-xl [&_blockquote_p]:md:text-2xl [&_blockquote_p]:font-semibold [&_blockquote_p]:leading-snug [&_blockquote_p]:text-foreground [&_blockquote_p]:mb-0',
                // Code blocks
                '[&_pre]:rounded-md [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:my-6 [&_pre]:overflow-x-auto',
                '[&_code]:text-sm [&_code]:font-mono',
                '[&_:not(pre)_code]:rounded [&_:not(pre)_code]:bg-muted [&_:not(pre)_code]:px-1.5 [&_:not(pre)_code]:py-0.5 [&_:not(pre)_code]:text-sm',
              ].join(' ')}
            >
              <PostContent content={post.content} />
            </div>
          )}

          {/* End-of-article like CTA */}
          <div className="mt-12 flex flex-col items-center gap-4 border-t border-border pt-12">
            <p className="text-sm font-medium text-muted-foreground">Enjoyed this article?</p>
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

          {/* Related articles */}
          {related && related.length > 0 && (
            <div className="mt-16 border-t border-border pt-12">
              <p className="mb-1 text-xs font-medium tracking-widest text-muted-foreground uppercase">
                Continue reading
              </p>
              <h2 className="mb-6 font-sans text-2xl font-black tracking-tight text-foreground">
                Related articles
              </h2>
              <div className="flex flex-col gap-px border border-border bg-border">
                {related
                  .filter((p) => !!p.slug)
                  .map((relPost, idx) => (
                    <RelatedCard
                      key={relPost.slug}
                      slug={relPost.slug!}
                      title={relPost.title}
                      authorName={relPost.author.name}
                      publishedAt={relPost.publishedAt}
                      coverImage={relPost.coverImage}
                      index={idx}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Comments */}
          {post && (
            <div className="mt-16">
              <CommentsList postId={postSlug} postAuthorId={post.author.name} />
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
