import type { UserPostSchema } from '@boilerstone/openapi-generator'
import { Badge } from '@boilerstone/ui/components/primitives/badge'
import { Card, CardFooter, CardHeader, CardTitle } from '@boilerstone/ui/components/primitives/card'
import { Link } from 'react-router'

export function UserPostCard({ post }: { post: Omit<UserPostSchema, 'content'> }) {
  return (
    <Link to={`/dashboard/posts/${post.id}/edit`} className="block">
      <Card className="overflow-hidden hover:bg-background transition-colors bg-background/50 duration-200 backdrop-blur-sm">
        {post.coverImage && (
          <img
            src={post.coverImage}
            alt={post.title}
            className="mb-3 aspect-video w-full rounded-md object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        )}
        <CardHeader>
          <CardTitle>
            {post.title}
            {' '}
            <Badge variant={post.publishedAt ? 'default' : 'secondary'} className="text-xs ml-2">{post.publishedAt ? 'Published' : 'Draft'}</Badge>
          </CardTitle>
          {post.tags && post.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {post.tags.map(tag => (
                <Badge key={tag.id} variant="outline" className="text-xs">{tag.name}</Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardFooter>
          <div className="w-full flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              Created at
              {' '}
              {new Date(post.versions[0].createdAt).toLocaleDateString()}
            </span>
            <span className="text-sm text-muted-foreground">
              Updated at
              {' '}
              {new Date(post.versions[
                post.versions.length - 1
              ].createdAt).toLocaleDateString()}
            </span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
