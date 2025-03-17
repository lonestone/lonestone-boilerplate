import { UserPostSchema } from "@lonestone/openapi-generator";
import {
  Card,
  CardTitle,
  CardHeader,
  CardFooter,
} from "@lonestone/ui/components/primitives/card";
import { Badge } from "@lonestone/ui/components/primitives/badge";
import { Link } from "react-router";
export const UserPostCard = ({ post }: { post: Omit<UserPostSchema, "content"> }) => {
  return (
    <Card className="hover:bg-background transition-colors bg-background/50 duration-200 backdrop-blur-sm" asChild>
      <Link to={`/dashboard/posts/${post.id}/edit`}>
        <CardHeader>
          <CardTitle>{post.title} <Badge variant={post.publishedAt ? "default" : "secondary"} className="text-xs ml-2">{post.publishedAt ? "Published" : "Draft"}</Badge></CardTitle>
        </CardHeader>
        <CardFooter>
          <div className="w-full flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              Created at {post.versions[0].createdAt.toLocaleDateString()}
            </span>
            <span className="text-sm text-muted-foreground">
              Updated at{" "}
              {post.versions[
                post.versions.length - 1
              ].createdAt.toLocaleDateString()}
            </span>
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
};
