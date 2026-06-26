import type { PublicPostsSchema } from '@boilerstone/openapi-generator'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Calendar, Heart, MessageCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

interface PostCardProps {
  post: PublicPostsSchema['data'][number]
  index?: number
}

export default function PostCard({ post, index = 0 }: PostCardProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const activeTag = searchParams.get('tag')
  const reduced = useReducedMotion()

  const excerpt = useMemo(() => {
    const text = post.contentPreview?.data ?? ''
    return text.length > 160 ? `${text.slice(0, 160)}…` : text
  }, [post.contentPreview])

  const handleTagClick = (e: React.MouseEvent, tagSlug: string) => {
    e.preventDefault()
    const newParams = new URLSearchParams(searchParams)
    if (activeTag === tagSlug) {
      newParams.delete('tag')
    } else {
      newParams.set('tag', tagSlug)
    }
    newParams.set('page', '1')
    setSearchParams(newParams)
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.06 }}
    >
      <Link to={`/posts/${post.slug}`} viewTransition className="group block">
        <article className="flex flex-col overflow-hidden border border-border bg-background transition-all duration-200 hover:border-foreground/20 hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] md:flex-row dark:hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
          {/* Cover — image, or a branded fallback so every card stays consistent */}
          <div className="relative w-full shrink-0 overflow-hidden bg-muted md:w-64 lg:w-80">
            <div className="aspect-video md:h-full md:min-h-[13rem]">
              {post.coverImage && !imgError ? (
                <img
                  src={post.coverImage}
                  alt={post.title}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgError(true)}
                  className={[
                    'h-full w-full object-cover transform-gpu transition-all duration-700 group-hover:scale-105',
                    imgLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm',
                  ].join(' ')}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <span className="select-none font-sans text-5xl font-black uppercase tracking-tight text-muted-foreground/20">
                    {post.title.slice(0, 2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col justify-between p-6 md:p-8">
            <div>
              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={(e) => handleTagClick(e, tag.slug)}
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                    >
                      <Badge
                        variant={activeTag === tag.slug ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors hover:border-foreground/40"
                      >
                        {tag.name}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              {/* Title */}
              <h2 className="mb-2 font-sans text-xl font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-foreground md:text-2xl">
                {post.title}
              </h2>

              {/* Excerpt */}
              {excerpt && (
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                  {excerpt}
                </p>
              )}
            </div>

            {/* Footer meta */}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{post.author.name}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(post.publishedAt).toLocaleDateString('en', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {post.likesCount}
                </span>
                {post.commentCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {post.commentCount}
                  </span>
                )}
              </div>

              {/* Read arrow */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  )
}
