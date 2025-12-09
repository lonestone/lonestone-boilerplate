import type { PublicPostsSchema } from '@boilerstone/openapi-generator'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@boilerstone/ui/components/primitives/card'
import { ArrowUpRight, Calendar, MessageCircle, User } from 'lucide-react'

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
    <Card className="group/card-post overflow-hidden transition-all hover:shadow-lg" asChild>
      <Link to={`/posts/${post.slug}`} className="block p-6 hover:bg-muted/50">
        <CardHeader className="flex flex-row justify-between">
          <CardTitle>{post.title}</CardTitle>
          <div className="flex items-center gap-2 group-hover/card-post:bg-primary group-hover/card-post:text-primary-foreground text-muted-foreground rounded-full p-1">
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{getFirstTextContent}</p>
        </CardContent>
        <CardFooter>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>{post.author.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
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
      </Link>
    </Card>
  )
}
