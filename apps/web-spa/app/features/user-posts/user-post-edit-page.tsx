import type {
  UpdatePostSchema,
} from '@lonestone/openapi-generator'
import { Button } from '@lonestone/ui/components/primitives/button'
import { SendIcon } from '@lonestone/ui/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import { apiClient } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'
import UserPostForm, { UserPostFormSkeleton } from './user-post-form'

export default function UserPostEditPage() {
  const { userPostId } = useParams()
  const navigate = useNavigate()

  const { data: post, isLoading } = useQuery({
    queryKey: ['userPost', userPostId],
    queryFn: () =>
      apiClient.postControllerGetUserPost({
        path: {
          id: userPostId as string,
        },
      }),
  })

  const { mutate: UpdatePost, isPending } = useMutation({
    mutationFn: (data: UpdatePostSchema) =>
      apiClient.postControllerUpdatePost({
        body: data,
        path: {
          id: userPostId as string,
        },
      }),
    onSuccess: (result) => {
      navigate(`/dashboard/posts/${result.data?.id}/edit`)
    },
  })

  const { mutate: PublishPost, isPending: isPublishing } = useMutation({
    mutationFn: () =>
      apiClient.postControllerPublishPost({
        path: { id: userPostId as string },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPost', userPostId] })
    },
  })

  const { mutate: UnpublishPost, isPending: isUnpublishing } = useMutation({
    mutationFn: () =>
      apiClient.postControllerUnpublishPost({
        path: { id: userPostId as string },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPost', userPostId] })
    },
  })

  const onSubmit = async (data: UpdatePostSchema) => {
    try {
      await UpdatePost(data)
    }
    catch (error) {
      console.error(error)
    }
  }

  const onPublish = async () => {
    try {
      if (post?.data?.publishedAt) {
        await UnpublishPost()
      }
      else {
        await PublishPost()
      }
    }
    catch (error) {
      console.error(error)
    }
  }

  // Show skeleton while loading
  if (isLoading) {
    return <UserPostFormSkeleton />
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Edit Post</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Share your thoughts, images, and videos with the world.
          </p>
        </div>
        <div>
          <Button size="sm" onClick={onPublish} disabled={isPublishing || isUnpublishing || isPending}>
            {post?.data?.publishedAt
              ? (
                  <>
                    <SendIcon className="size-4" />
                    Unpublish
                  </>
                )
              : (
                  <>
                    <SendIcon className="size-4" />
                    Publish
                  </>
                )}
          </Button>
        </div>
      </div>
      <UserPostForm
        onSubmit={onSubmit}
        initialData={{
          title: post?.data?.title ?? '',
          content: post?.data?.content ?? [],
        }}
        isSubmitting={isPending}
      />
    </div>
  )
}
