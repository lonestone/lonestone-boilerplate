import { useState, useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Separator } from "@lonestone/ui/components/primitives/separator";
import {
  Alert,
  AlertDescription,
} from "@lonestone/ui/components/primitives/alert";
import { useInView } from "@lonestone/ui/hooks/use-in-view";
import { CommentForm } from "./comment-form";
import {
  commentsControllerCreateComment,
  commentsControllerGetComments,
  commentsControllerGetCommentReplies,
  CreateCommentSchema,
  commentsControllerDeleteComment,
} from "@lonestone/openapi-generator";
import { CommentItem } from "@/features/comments/comment-item";
import { Loader2, MessageSquare } from "lucide-react";
import { cn } from "@lonestone/ui/lib/utils";
import { Card, CardContent } from "@lonestone/ui/components/primitives/card";
import { Skeleton } from "@lonestone/ui/components/primitives/skeleton";

type CommentsListProps = {
  postId: string;
  postAuthorId?: string;
  currentUserId?: string;
};

export function CommentsList({
  postId,
  postAuthorId,
  currentUserId,
}: CommentsListProps) {
  const queryClient = useQueryClient();
  const [replyingTo, setReplyingTo] = useState<string | undefined>(undefined);
  const [showRepliesFor, setShowRepliesFor] = useState<Set<string>>(new Set());
  const { ref, inView } = useInView();

  // Add comment mutation
  const { mutateAsync: addComment, isPending: isAddingComment } = useMutation({
    mutationFn: async (data: CreateCommentSchema & { parentId?: string }) => {
      return await commentsControllerCreateComment({
        body: data,
        path: {
          postSlug: postId,
        },
      });
    },
    onSuccess: (result) => {
      // Invalidate comments query to refetch
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });

      // If this is a reply, also invalidate the replies query
      if (result.data?.parentId) {
        queryClient.invalidateQueries({
          queryKey: ["replies", result.data.parentId],
        });
      }
    },
  });

  const onSubmit = async (data: CreateCommentSchema) => {
    try {
      await addComment({
        ...data,
      });
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  // Fetch comments with infinite scroll
  const {
    data: commentsPages,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["comments", postId],
    queryFn: async ({ pageParam = 0 }) => {
      return commentsControllerGetComments({
        path: {
          postSlug: postId,
        },
        query: {
          offset: pageParam as number,
        },
      });
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.data?.meta?.hasMore) {
        return lastPage.data.meta.offset + lastPage.data.meta.pageSize;
      }
      return undefined;
    },
    initialPageParam: 0,
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return commentsControllerDeleteComment({
        path: {
          commentId,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });

      // Also invalidate any replies queries that might be affected
      Array.from(showRepliesFor).forEach((commentId) => {
        queryClient.invalidateQueries({ queryKey: ["replies", commentId] });
      });
    },
    onError: (error) => {
      console.error("Error deleting comment:", error);
    },
  });

  // Toggle showing replies for a comment
  const toggleReplies = async (commentId: string) => {
    const newShowRepliesFor = new Set(showRepliesFor);

    if (showRepliesFor.has(commentId)) {
      newShowRepliesFor.delete(commentId);
    } else {
      newShowRepliesFor.add(commentId);
      // Fetch replies if not already loaded
      if (!queryClient.getQueryData(["replies", commentId])) {
        try {
          const repliesData = await commentsControllerGetCommentReplies({
            path: {
              commentId,
            },
            query: {
              offset: 0,
            },
          });
          queryClient.setQueryData(["replies", commentId], repliesData);
        } catch (error) {
          console.error("Error fetching replies:", error);
        }
      }
    }

    setShowRepliesFor(newShowRepliesFor);
  };

  // Load more replies
  const loadMoreReplies = async (commentId: string) => {
    // Use any type to avoid type errors with the API response
    const currentReplies = queryClient.getQueryData<any>([
      "replies",
      commentId,
    ]);
    if (!currentReplies || !currentReplies.data?.meta) return;

    try {
      const offset =
        currentReplies.data.meta.offset + currentReplies.data.meta.pageSize;
      const newReplies = await commentsControllerGetCommentReplies({
        path: {
          commentId,
        },
        query: {
          offset,
        },
      });

      // Merge the new replies with existing ones
      if (currentReplies.data && newReplies.data) {
        queryClient.setQueryData(["replies", commentId], {
          ...newReplies,
          data: {
            ...newReplies.data,
            data: [...currentReplies.data.data, ...newReplies.data.data],
          },
        });
      }
    } catch (error) {
      console.error("Error loading more replies:", error);
    }
  };

  const allComments = useMemo(() => {
    return commentsPages?.pages.flatMap((page) => page.data?.data || []) || [];
  }, [commentsPages]);

  // Check if we need to load more comments when scrolling
  if (inView && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>Failed to load comments</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-2xl font-bold">Comments</h2>
        {!isLoading && allComments.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{allComments.length}</span>
          </div>
        )}
      </div>

      <CommentForm
        initialData={{
          content: "",
        }}
        onSubmit={onSubmit}
        isPending={isAddingComment}
      />

      <Separator className="my-6" />

      {isLoading ? (
        <div className="space-y-4">
          <CommentSkeleton />
          <CommentSkeleton />
          <CommentSkeleton />
        </div>
      ) : allComments.length > 0 ? (
        <div className="space-y-4">
          {allComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isReplyingTo={replyingTo}
              showRepliesFor={showRepliesFor}
              currentUserId={currentUserId}
              postAuthorId={postAuthorId}
              isAddingComment={isAddingComment}
              onReply={setReplyingTo}
              onToggleReplies={toggleReplies}
              onDelete={(commentId) => deleteCommentMutation.mutate(commentId)}
              onLoadMoreReplies={loadMoreReplies}
              onReplySuccess={(data) => {
                setReplyingTo(undefined);
                onSubmit(data);
              }}
            />
          ))}

          {/* Intersection observer target for infinite scroll */}
          {hasNextPage && (
            <div
              ref={ref}
              className={cn(
                "h-10 flex items-center justify-center",
                isFetchingNextPage ? "opacity-100" : "opacity-0"
              )}
            >
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading more comments...</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <Card className="border-dashed border-2 bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-center text-muted-foreground font-medium mb-1">
              No comments yet
            </p>
            <p className="text-center text-sm text-muted-foreground/70">
              Be the first to share your thoughts!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Skeleton loader for comments
function CommentSkeleton() {
  return (
    <Card className="mb-4 border shadow-none">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-7 w-24" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
