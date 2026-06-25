import type { UserPostSchema } from '@boilerstone/openapi-generator'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Card, CardFooter, CardHeader, CardTitle } from '@boilerstone/ui/components/primitives/card'
import { useMemo } from 'react'
import { Link } from 'react-router'

export function UserPostCard({ post }: { post: Omit<UserPostSchema, 'content'> }) {
  const firstVersionDate = post.versions[0].createdAt
  const lastVersionDate = post.versions[post.versions.length - 1].createdAt
  const createdAt = useMemo(() => new Date(firstVersionDate).toLocaleDateString(), [firstVersionDate])
  const updatedAt = useMemo(() => new Date(lastVersionDate).toLocaleDateString(), [lastVersionDate])

  return (
    <Card className="hover:bg-background transition-colors bg-background/50 duration-200 backdrop-blur-sm" asChild>
      <Link to={`/dashboard/posts/${post.id}/edit`}>
        <CardHeader>
          <CardTitle>
            {post.title}
            {' '}
            <Badge variant={post.publishedAt ? 'default' : 'secondary'} className="text-xs ml-2">{post.publishedAt ? 'Published' : 'Draft'}</Badge>
          </CardTitle>
        </CardHeader>
        <CardFooter>
          <div className="w-full flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              Created at
              {' '}
              {createdAt}
            </span>
            <span className="text-sm text-muted-foreground">
              Updated at
              {' '}
              {updatedAt}
            </span>
          </div>
        </CardFooter>
      </Link>
    </Card>
  )
}
