import type { Route } from './+types/home-page'
import type { PublicPostsSchema } from '@boilerstone/openapi-generator'
import { publicPostControllerGetPosts } from '@boilerstone/openapi-generator/client/sdk.gen'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { ArrowRight, BookOpen, Pen } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

type TeaserPost = PublicPostsSchema['data'][number]

function TeaserCard({ post, index }: { post: TeaserPost, index: number }) {
  const [imgError, setImgError] = useState(false)
  const preview = post.contentPreview?.data ?? ''
  const excerpt = preview.length > 120 ? `${preview.slice(0, 120)}…` : preview

  return (
    <Link
      to={`/posts/${post.slug}`}
      className="group relative flex flex-col bg-background p-6 transition-colors hover:bg-accent/50 md:p-8"
    >
      {/* Index number */}
      <span className="mb-4 font-mono text-xs font-medium text-muted-foreground/50 tabular-nums">
        0{index + 1}
      </span>

      {/* Cover — always present (image or branded fallback) for consistent cards */}
      <div className="mb-4 aspect-video overflow-hidden rounded-sm bg-muted">
        {post.coverImage && !imgError
          ? (
              <img
                src={post.coverImage}
                alt={post.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setImgError(true)}
              />
            )
          : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="select-none font-sans text-4xl font-black uppercase tracking-tight text-muted-foreground/20">
                  {post.title.slice(0, 2)}
                </span>
              </div>
            )}
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {post.tags.slice(0, 2).map(tag => (
            <Badge key={tag.id} variant="outline" className="h-4 text-[10px]">
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Title */}
      <h3 className="mb-2 font-sans text-lg font-bold leading-snug tracking-tight text-foreground md:text-xl">
        {post.title}
      </h3>

      {/* Excerpt */}
      {excerpt && (
        <p className="mb-4 line-clamp-2 flex-1 text-sm text-muted-foreground">
          {excerpt}
        </p>
      )}

      {/* Meta */}
      <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Pen className="h-3 w-3" />
          {post.author.name}
        </span>
        <span className="flex items-center gap-1">
          <BookOpen className="h-3 w-3" />
          {new Date(post.publishedAt).toLocaleDateString('en', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      </div>

      {/* Arrow indicator */}
      <div className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground opacity-0 transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground group-hover:opacity-100 md:right-6 md:top-6">
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  )
}

export async function loader() {
  try {
    const result = await publicPostControllerGetPosts({
      query: { offset: 0, pageSize: 3, filter: [] },
    })

    return {
      latestPosts: result.data?.data ?? [],
      totalPosts: result.data?.meta.itemCount ?? 0,
    }
  }
  catch {
    return {
      latestPosts: [],
      totalPosts: 0,
    }
  }
}

export default function HomePage({ loaderData }: Route.ComponentProps) {
  const { latestPosts, totalPosts } = loaderData

  return (
    <div>
      {/* Hero section */}
      <section className="relative overflow-hidden border-b border-border/60">
        {/* Background accent blobs */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-primary/6 blur-3xl" />
        </div>

        <div className="container relative mx-auto px-4 py-20 md:px-6 md:py-32 lg:py-40">
          <div className="max-w-3xl">
            {/* Eyebrow */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                Journal
              </span>
            </div>

            {/* Headline */}
            <h1 className="mb-6 font-sans text-5xl font-black leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl">
              Ideas worth{' '}
              <span className="relative inline-block">
                <span className="relative z-10">reading.</span>
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 left-0 z-0 h-4 w-full bg-primary md:h-5 lg:h-6"
                />
              </span>
            </h1>

            <p className="mb-10 max-w-xl text-lg text-muted-foreground md:text-xl">
              A curated journal of engineering insights, product thinking, and the craft of building
              great software — from the Lonestone team.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/posts"
                className="group inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Read the journal
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              {totalPosts > 0 && (
                <span className="text-sm text-muted-foreground">
                  {totalPosts} {totalPosts === 1 ? 'article' : 'articles'} published
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Latest posts teaser */}
      {latestPosts.length > 0 && (
        <section className="container mx-auto px-4 py-16 md:px-6 md:py-24">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="mb-1 text-xs font-medium tracking-widest text-muted-foreground uppercase">
                Latest
              </p>
              <h2 className="font-sans text-3xl font-black tracking-tight text-foreground md:text-4xl">
                Recent writing
              </h2>
            </div>
            <Link
              to="/posts"
              className="group hidden items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:flex"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="grid gap-px border border-border bg-border md:grid-cols-3">
            {latestPosts.map((post, index) => (
              <TeaserCard key={post.slug} post={post} index={index} />
            ))}
          </div>

          {/* Mobile view all link */}
          <div className="mt-6 flex justify-center md:hidden">
            <Link
              to="/posts"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View all articles
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}

export function meta() {
  return [
    { title: 'Lonestone Journal' },
    { property: 'og:title', content: 'Lonestone Journal' },
    {
      name: 'description',
      content: 'Engineering insights and product thinking from the Lonestone team.',
    },
  ]
}
