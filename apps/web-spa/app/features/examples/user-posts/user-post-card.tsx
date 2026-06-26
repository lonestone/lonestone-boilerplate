import type { UserPostSchema } from '@boilerstone/openapi-generator'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { ArrowRight, CalendarDays, Clock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

export function UserPostCard({ post }: { post: Omit<UserPostSchema, 'content'> }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const createdAt = new Date(post.versions[0].createdAt)
  const updatedAt = new Date(post.versions[post.versions.length - 1].createdAt)
  const isUpdated = updatedAt.getTime() !== createdAt.getTime()

  return (
    <Link to={`/dashboard/posts/${post.id}/edit`} className="group block h-full">
      <article className="relative flex flex-col overflow-hidden border border-border bg-card transition-all duration-200 hover:border-foreground/20 hover:shadow-[0_2px_16px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_2px_16px_rgba(0,0,0,0.25)] h-full">
        {/* Cover image with blur-up */}
        {post.coverImage && !imgError
          ? (
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                <img
                  src={post.coverImage}
                  alt={post.title}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgError(true)}
                  className={[
                    'h-full w-full object-cover transition-all duration-700 group-hover:scale-105',
                    imgLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-[1.03]',
                  ].join(' ')}
                />
                {/* Subtle grain overlay on cover */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-grain opacity-[0.08] mix-blend-overlay"
                />
              </div>
            )
          : (
              <div className="aspect-video w-full bg-muted/50 flex items-center justify-center relative overflow-hidden">
                <span className="text-2xl font-black tracking-tight text-muted-foreground/20 select-none uppercase">
                  {post.title.slice(0, 2)}
                </span>
                {/* Grain on fallback too */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-grain opacity-[0.06] mix-blend-overlay"
                />
              </div>
            )}

        {/* Card body */}
        <div className="flex flex-1 flex-col p-4">
          {/* Status + tags row */}
          <div className="mb-3 flex items-center gap-1.5 flex-wrap">
            <Badge variant={post.publishedAt ? 'default' : 'secondary'} className="text-[10px] h-4">
              {post.publishedAt ? 'Published' : 'Draft'}
            </Badge>
            {post.tags && post.tags.map(tag => (
              <Badge key={tag.id} variant="outline" className="text-[10px] h-4">
                {tag.name}
              </Badge>
            ))}
          </div>

          {/* Title */}
          <h3 className="mb-auto font-sans text-base font-bold leading-snug tracking-tight text-foreground group-hover:text-foreground line-clamp-2">
            {post.title}
          </h3>

          {/* Footer meta */}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {createdAt.toLocaleDateString()}
              </span>
              {isUpdated && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {updatedAt.toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}
