import { CommentForm } from "@/features/comments/comment-form";
import {
  CommentSchema,
  CreateCommentSchema,
  commentsControllerGetCommentReplies,
} from "@lonestone/openapi-generator";
import { Button } from "@lonestone/ui/components/primitives/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@lonestone/ui/components/primitives/card";
import { Separator } from "@lonestone/ui/components/primitives/separator";
import {
  User,
  Reply,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { cn } from "@lonestone/ui/lib/utils";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

// Component for rendering a single comment with its replies
type CommentItemProps = {
  comment: CommentSchema;
  isReplyingTo: string | undefined;
  showRepliesFor: Set<string>;
  currentUserId?: string;
  postAuthorId?: string;
  isAddingComment: boolean;
  depth?: number;
  onReply: (commentId: string) => void;
  onToggleReplies: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onLoadMoreReplies: (commentId: string) => void;
  onReplySuccess: (data: CreateCommentSchema) => void;
};

export function CommentItem({
  comment,
  isReplyingTo,
  showRepliesFor,
  currentUserId,
  postAuthorId,
  isAddingComment,
  depth = 0,
  onReply,
  onToggleReplies,
  onDelete,
  onLoadMoreReplies,
  onReplySuccess,
}: CommentItemProps) {
  const isAuthor = currentUserId && comment.user?.id === currentUserId;
  const isPostAuthor = currentUserId === postAuthorId;
  const canDelete = isAuthor || isPostAuthor;
  const formattedDate = new Date(comment.createdAt).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
  const [isHovered, setIsHovered] = useState(false);
  const isReplying = isReplyingTo === comment.id;
  const showReplies = showRepliesFor.has(comment.id);
  const hasReplies = comment.replyCount !== undefined && comment.replyCount > 0;

  // Fetch replies for this comment
  const { data: repliesData, isLoading: isLoadingReplies } = useQuery({
    queryKey: ["replies", comment.id],
    queryFn: async () => {
      return commentsControllerGetCommentReplies({
        path: {
          commentId: comment.id,
        },
        query: {
          offset: 0,
        },
      });
    },
    enabled: showReplies,
  });

  const replies = repliesData?.data?.data || [];
  const hasMoreReplies = repliesData?.data?.meta?.hasMore || false;

  // Calculate indentation based on depth
  const isNested = depth > 0;
  const maxDepth = 5; // Limit the visual nesting to prevent excessive indentation

  return (
    <div
      className={cn(
        "relative group/comment-item",
        isNested && "ml-2 md:ml-4 pl-2 md:pl-4 pt-3"
      )}
    >
      {/* Vertical line connecting replies */}
      {isNested && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-px bg-border group-last/comment-item:bottom-1/2" />
          <div className="group-last/comment-item:block absolute left-0 h-28 size-[1rem] border-b border-l rounded-bl-full" />
        </>
      )}

      <Card
        key={comment.id}
        className={cn(
          "border transition-all duration-200 hover:border-primary/20",
          isReplying ? "border-primary/30 shadow-sm" : "shadow-none",
          isNested && "border-l-2"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardHeader className={cn("pb-2", isNested && "pt-3 pb-1")}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex-shrink-0 flex items-center justify-center rounded-full bg-primary/10",
                  isNested ? "h-6 w-6" : "h-8 w-8"
                )}
              >
                <User
                  className={cn(
                    "text-primary",
                    isNested ? "h-3 w-3" : "h-4 w-4"
                  )}
                />
              </div>
              <div>
                <span className="font-semibold text-sm">
                  {comment.user?.name || "Anonymous"}
                </span>
                {isPostAuthor && comment.user?.id === postAuthorId && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    Author
                  </span>
                )}
                <div className="text-xs text-muted-foreground">
                  {formattedDate}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn("py-2", isNested && "py-1")}>
          <p
            className={cn(
              "whitespace-pre-line",
              isNested ? "text-xs" : "text-sm"
            )}
          >
            {comment.content}
          </p>
        </CardContent>
        <CardFooter className={cn(isNested && "pt-0 pb-2")}>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReply(comment.id)}
              className={cn(
                "text-xs h-7 px-2 transition-opacity",
                isHovered || isReplying ? "opacity-100" : "opacity-70",
                isNested && "h-6 px-1.5"
              )}
            >
              <Reply
                className={cn("mr-1", isNested ? "h-2.5 w-2.5" : "h-3 w-3")}
              />
              Reply
            </Button>

            {hasReplies && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleReplies(comment.id)}
                className={cn(
                  "text-xs h-7 px-2",
                  showReplies ? "text-primary" : "",
                  isHovered ? "opacity-100" : "opacity-80",
                  isNested && "h-6 px-1.5"
                )}
              >
                {showReplies ? (
                  <ChevronUp
                    className={cn("mr-1", isNested ? "h-2.5 w-2.5" : "h-3 w-3")}
                  />
                ) : (
                  <ChevronDown
                    className={cn("mr-1", isNested ? "h-2.5 w-2.5" : "h-3 w-3")}
                  />
                )}
                {showReplies ? "Hide" : "Show"} {comment.replyCount}{" "}
                {comment.replyCount === 1 ? "reply" : "replies"}
              </Button>
            )}
          </div>

          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(comment.id)}
              className={cn(
                "text-xs h-7 px-2 text-destructive transition-opacity",
                isHovered ? "opacity-100" : "opacity-0",
                isNested && "h-6 px-1.5"
              )}
            >
              <Trash2
                className={cn("mr-1", isNested ? "h-2.5 w-2.5" : "h-3 w-3")}
              />
              Delete
            </Button>
          )}
        </CardFooter>

        {isReplying && (
          <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <Separator className="my-2" />
            <CommentForm
              isPending={isAddingComment}
              initialData={{
                content: "",
                parentId: comment.id,
              }}
              onSubmit={onReplySuccess}
              onCancel={() => onReply("")}
            />
          </div>
        )}
      </Card>

      {/* Render replies recursively */}
      {showReplies && (
        <div
          className={cn(
            "animate-in fade-in slide-in-from-top-1 duration-200",
            isLoadingReplies ? "opacity-70" : ""
          )}
        >
          {isLoadingReplies && (
            <div className="flex justify-center py-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading replies...</span>
              </div>
            </div>
          )}

          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isReplyingTo={isReplyingTo}
              showRepliesFor={showRepliesFor}
              currentUserId={currentUserId}
              postAuthorId={postAuthorId}
              isAddingComment={isAddingComment}
              depth={depth + 1}
              onReply={onReply}
              onToggleReplies={onToggleReplies}
              onDelete={onDelete}
              onLoadMoreReplies={onLoadMoreReplies}
              onReplySuccess={onReplySuccess}
            />
          ))}

          {hasMoreReplies && (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "mt-2 text-xs",
                isNested ? "h-6 text-xs ml-8" : "h-8 w-full"
              )}
              onClick={() => onLoadMoreReplies(comment.id)}
            >
              Load more replies
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
