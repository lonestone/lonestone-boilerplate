import type { CommentSchema, CreateCommentSchema } from '@boilerstone/openapi-generator'
import { commentsControllerGetCommentReplies } from '@boilerstone/openapi-generator/client/sdk.gen'
import { Button } from '@boilerstone/ui/components/primitives/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@boilerstone/ui/components/primitives/card'
import { Separator } from '@boilerstone/ui/components/primitives/separator'
import { cn } from '@boilerstone/ui/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Loader2, Reply, Trash2, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CommentForm } from '@/features/comments/comment-form'

function Replies({
  commentId,
  postSlug,
  currentUserId,
  postAuthorId,
  isAddingComment,
  depth,
  onDelete,
  onReplySubmit,
}: {
  commentId: string
  postSlug: string
  currentUserId?: string
  postAuthorId?: string
  isAddingComment: boolean
  depth: number
  onDelete: (commentId: string) => void
  onReplySubmit: (data: CreateCommentSchema) => Promise<void>
}) {
  const { data: replies, isLoading: isLoadingReplies } = useQuery({
    queryKey: ['replies', postSlug, commentId],
    queryFn: async () => {
      const res = await commentsControllerGetCommentReplies({
        path: {
          commentId,
          postSlug,
        },
        query: {
          offset: 0,
          pageSize: 10,
        },
      })

      if (res.error) {
        throw res.error
      }

      return res.data
    },
  })

  if (isLoadingReplies) {
    return (
      <div className="flex justify-center py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading replies...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
      {replies?.data.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          postSlug={postSlug}
          currentUserId={currentUserId}
          postAuthorId={postAuthorId}
          isAddingComment={isAddingComment}
          depth={depth + 1}
          onDelete={onDelete}
          onReplySubmit={onReplySubmit}
        />
      ))}
    </div>
  )
}

// Component for rendering a single comment with its replies
interface CommentItemProps {
  comment: CommentSchema
  postSlug: string
  currentUserId?: string
  postAuthorId?: string
  isAddingComment: boolean
  depth?: number
  onDelete: (commentId: string) => void
  onReplySubmit: (data: CreateCommentSchema) => Promise<void>
}

export function CommentItem({
  comment,
  postSlug,
  currentUserId,
  postAuthorId,
  isAddingComment,
  depth = 0,
  onDelete,
  onReplySubmit,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const replyCount = comment.replyCount ?? 0
  const isAuthor = currentUserId && comment.user?.id === currentUserId
  const isPostAuthor = currentUserId === postAuthorId
  const canDelete = isAuthor || isPostAuthor
  const formattedDate = new Date(comment.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const [isHovered, setIsHovered] = useState(false)

  const hasReplies = useMemo(() => replyCount !== undefined && replyCount > 0, [replyCount])

  // Calculate indentation based on depth
  const isNested = depth > 0

  const toggleReplies = () => {
    setShowReplies((prev) => !prev)
  }

  return (
    <div
      className={cn(
        'relative',
        isNested && 'ml-2 md:ml-4 pl-2 md:pl-4 pt-3',
        'last:[&>.comment-line]:h-28 last:[&>.comment-line-end]:block',
      )}
    >
      {/* Vertical line connecting replies */}
      {isNested && (
        <>
          <div className="comment-line absolute left-0 top-0 h-full w-px bg-border" />
          <div className="comment-line-end absolute left-0 h-28 size-[1rem] border-b border-l rounded-bl-full" />
        </>
      )}

      <Card
        key={comment.id}
        className={cn(
          'border transition-all duration-200 hover:border-primary/20',
          isReplying ? 'border-primary/30 shadow-sm' : 'shadow-none',
          isNested && 'border-l-2',
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex-shrink-0 flex items-center justify-center rounded-full bg-primary/10',
                  isNested ? 'h-6 w-6' : 'h-8 w-8',
                )}
              >
                <User className={cn('text-primary', isNested ? 'h-3 w-3' : 'h-4 w-4')} />
              </div>
              <div>
                <span className="font-semibold text-sm">{comment.user?.name || 'Anonymous'}</span>
                {isPostAuthor && comment.user?.id === postAuthorId && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    Author
                  </span>
                )}
                <div className="text-xs text-muted-foreground">{formattedDate}</div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn('py-2', isNested && 'py-1')}>
          <p className={cn('whitespace-pre-line', isNested ? 'text-xs' : 'text-sm')}>
            {comment.content}
          </p>
        </CardContent>
        <CardFooter className={cn(isNested && 'pt-0 pb-2')}>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsReplying(true)}
              className={cn(
                'text-xs h-7 px-2 transition-opacity',
                isHovered || isReplying ? 'opacity-100' : 'opacity-70',
                isNested && 'h-6 px-1.5',
              )}
            >
              <Reply className={cn('mr-1', isNested ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
              Reply
            </Button>

            {hasReplies && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleReplies}
                className={cn(
                  'text-xs h-7 px-2',
                  showReplies ? 'text-primary' : '',
                  isHovered ? 'opacity-100' : 'opacity-80',
                  isNested && 'h-6 px-1.5',
                )}
              >
                {showReplies ? (
                  <ChevronUp className={cn('mr-1', isNested ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
                ) : (
                  <ChevronDown className={cn('mr-1', isNested ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
                )}
                {showReplies ? 'Hide' : 'Show'} {replyCount}{' '}
                {replyCount === 1 ? 'reply' : 'replies'}
              </Button>
            )}
          </div>

          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(comment.id)}
              className={cn(
                'text-xs h-7 px-2 text-destructive transition-opacity',
                isHovered ? 'opacity-100' : 'opacity-0',
                isNested && 'h-6 px-1.5',
              )}
            >
              <Trash2 className={cn('mr-1', isNested ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
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
                content: '',
                parentId: comment.id,
              }}
              onSubmit={async (data) => {
                await onReplySubmit(data)
                setIsReplying(false)
                setShowReplies(true)
              }}
            />
          </div>
        )}
      </Card>

      {showReplies && (
        <Replies
          commentId={comment.id}
          postSlug={postSlug}
          currentUserId={currentUserId}
          postAuthorId={postAuthorId}
          isAddingComment={isAddingComment}
          depth={depth}
          onDelete={onDelete}
          onReplySubmit={onReplySubmit}
        />
      )}
    </div>
  )
}
