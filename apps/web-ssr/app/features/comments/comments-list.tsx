import type { CreateCommentSchema } from '@boilerstone/openapi-generator'
import { EmptyState } from '@boilerstone/ui/components/app/empty-state'
import { Section, SectionHeader } from '@boilerstone/ui/components/app/section'
import { Alert, AlertDescription } from '@boilerstone/ui/components/primitives/alert'
import { Card, CardContent } from '@boilerstone/ui/components/primitives/card'
import { Separator } from '@boilerstone/ui/components/primitives/separator'
import { Skeleton } from '@boilerstone/ui/components/primitives/skeleton'
import { useInView } from '@boilerstone/ui/hooks/use-in-view'
import { cn } from '@boilerstone/ui/lib/utils'
import { Loader2, MessageSquare } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { CommentItem } from '@/features/comments/comment-item'
import {
  useAddComment,
  useComments,
  useDeleteComment,
} from '@/features/comments/hooks/use-comments'
import { CommentForm } from './comment-form'

interface CommentsListProps {
  postId: string
  postAuthorId?: string
  currentUserId?: string
}

export function CommentsList({ postId, postAuthorId, currentUserId }: CommentsListProps) {
  const { ref, inView } = useInView()

  const { mutateAsync: addComment, isPending: isAddingComment } = useAddComment(postId)

  const onSubmit = async (data: CreateCommentSchema): Promise<void> => {
    await addComment(data)
  }

  const {
    data: commentsPages,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useComments(postId)

  const deleteCommentMutation = useDeleteComment(postId)

  const allComments = useMemo(() => {
    return commentsPages?.pages.flatMap((page) => page?.data || []) || []
  }, [commentsPages])

  // Load the next page when the sentinel scrolls into view
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>Failed to load comments</AlertDescription>
      </Alert>
    )
  }

  return (
    <Section>
      <SectionHeader
        title="Comments"
        meta={
          !isLoading && allComments.length > 0 ? (
            <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-sm text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{allComments.length}</span>
            </div>
          ) : null
        }
      />

      <CommentForm initialData={EMPTY_COMMENT} onSubmit={onSubmit} isPending={isAddingComment} />

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
              postSlug={postId}
              currentUserId={currentUserId}
              postAuthorId={postAuthorId}
              isAddingComment={isAddingComment}
              onDelete={(commentId) =>
                deleteCommentMutation.mutate(commentId, {
                  onError: (error) => console.error('Error deleting comment:', error),
                })
              }
              onReplySubmit={async (data) => {
                await onSubmit(data)
              }}
            />
          ))}

          {/* Intersection observer target for infinite scroll */}
          {hasNextPage && (
            <div
              ref={ref}
              className={cn(
                'h-10 flex items-center justify-center',
                isFetchingNextPage ? 'opacity-100' : 'opacity-0',
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
        <EmptyState
          icon={<MessageSquare className="h-6 w-6 text-muted-foreground" />}
          title="No comments yet"
          description="Be the first to share your thoughts!"
          className="min-h-64 rounded-none border border-dashed border-border"
        />
      )}
    </Section>
  )
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
  )
}

const EMPTY_COMMENT: CreateCommentSchema = { content: '' }
