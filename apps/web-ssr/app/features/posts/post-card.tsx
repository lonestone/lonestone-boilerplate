import type { PublicPostsSchema } from '@boilerstone/openapi-generator'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@boilerstone/ui/components/primitives/card'
import { ArrowUpRight, Calendar, Heart, MessageCircle, User } from 'lucide-react'

import { useMemo } from 'react'
import { Link } from 'react-router'

interface PostCardProps {
  post: PublicPostsSchema['data'][number]
}

export default function PostCard({ post }: PostCardProps) {
  const getFirstTextContent = useMemo(() => {
    const textContent = post.contentPreview
    if (!textContent)
      return ''
    return textContent.data.length > 150
      ? `${textContent.data.slice(0, 150)}...`
      : textContent.data
  }, [post.contentPreview])

  return (
    <Link to={`/posts/${post.slug}`} className="block">
      <Card className="group/card-post overflow-hidden transition-all hover:shadow-lg hover:bg-muted/50">
        {post.coverImage && (
          <div className="aspect-video overflow-hidden">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        )}
        <div className="p-6">
          <CardHeader className="flex flex-row justify-between p-0 pb-2">
            <CardTitle>{post.title}</CardTitle>
            <div className="flex items-center gap-2 group-hover/card-post:bg-primary group-hover/card-post:text-primary-foreground text-muted-foreground rounded-full p-1">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </CardHeader>
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pb-2">
              {post.tags.map(tag => (
                <Badge key={tag.id} variant="outline">{tag.name}</Badge>
              ))}
            </div>
          )}
          <CardContent className="p-0 pb-4">
            <p className="text-muted-foreground text-sm">{getFirstTextContent}</p>
          </CardContent>
          <CardFooter className="p-0">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{post.author.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span>{post.likesCount}</span>
              </div>
              {post.commentCount !== undefined && (
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  <span>
                    {post.commentCount}
                    {' '}
                    {post.commentCount === 1 ? 'comment' : 'comments'}
                  </span>
                </div>
              )}
            </div>
          </CardFooter>
        </div>
      </Card>
    </Link>
  )
}
