import type { UserPostSchema } from '@lonestone/openapi-generator'
import { Badge } from '@lonestone/ui/components/primitives/badge'
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@lonestone/ui/components/primitives/card'
import { Link } from 'react-router'

export function UserPostCard({ post }: { post: Omit<UserPostSchema, 'content'> }) {
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
      </Link>
    </Card>
  )
}
