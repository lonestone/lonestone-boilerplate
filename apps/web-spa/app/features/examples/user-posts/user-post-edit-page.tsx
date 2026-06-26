import type { UpdatePostSchema } from '@boilerstone/openapi-generator'
import {
  postControllerGetUserPost,
  postControllerPublishPost,
  postControllerUnpublishPost,
  postControllerUpdatePost,
} from '@boilerstone/openapi-generator/client/sdk.gen'
import { Button } from '@boilerstone/ui/components/primitives/button'
import { toast } from '@boilerstone/ui/components/primitives/sonner'
import { SendIcon } from '@boilerstone/ui/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { queryClient } from '@/lib/query-client'
import UserPostForm, { UserPostFormSkeleton } from './user-post-form'

export default function UserPostEditPage() {
  const { userPostId } = useParams()
  const { t } = useTranslation()

  const { data: post, isLoading } = useQuery({
    queryKey: ['userPost', userPostId],
    queryFn: async () => {
      const response = await postControllerGetUserPost({
        path: {
          id: userPostId as string,
        },
      })

      if (response.error) {
        throw response.error
      }

      return response.data
    },
  })

  const { mutate: updatePost, isPending } = useMutation({
    mutationFn: (data: UpdatePostSchema) =>
      postControllerUpdatePost({
        body: data,
        path: {
          id: userPostId as string,
        },
      }),
    onSuccess: () => {
      toast.success(t('toasts.postUpdated'))
      queryClient.invalidateQueries({ queryKey: ['userPost', userPostId] })
    },
    onError: () => {
      toast.error(t('toasts.postUpdateError'))
    },
  })

  const { mutate: publishPost, isPending: isPublishing } = useMutation({
    mutationFn: () =>
      postControllerPublishPost({
        path: { id: userPostId as string },
      }),
    onSuccess: () => {
      toast.success(t('toasts.postPublished'))
      queryClient.invalidateQueries({ queryKey: ['userPost', userPostId] })
    },
    onError: () => {
      toast.error(t('toasts.postPublishError'))
    },
  })

  const { mutate: unpublishPost, isPending: isUnpublishing } = useMutation({
    mutationFn: () =>
      postControllerUnpublishPost({
        path: { id: userPostId as string },
      }),
    onSuccess: () => {
      toast.success(t('toasts.postUnpublished'))
      queryClient.invalidateQueries({ queryKey: ['userPost', userPostId] })
    },
    onError: () => {
      toast.error(t('toasts.postPublishError'))
    },
  })

  const onSubmit = async (data: UpdatePostSchema) => {
    try {
      await updatePost(data)
    }
    catch (error) {
      console.error(error)
    }
  }

  const onPublish = async () => {
    try {
      if (post?.publishedAt) {
        await unpublishPost()
      }
      else {
        await publishPost()
      }
    }
    catch (error) {
      console.error(error)
    }
  }

  if (isLoading) {
    return <UserPostFormSkeleton />
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <p className="mb-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            {t('posts.title')}
          </p>
          <h1 className="font-sans text-3xl font-black tracking-tight text-foreground">
            Edit Post
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your thoughts, images, and videos with the world.
          </p>
        </div>
        <Button
          size="sm"
          onClick={onPublish}
          disabled={isPublishing || isUnpublishing || isPending}
        >
          <SendIcon className="size-4" />
          {post?.publishedAt ? 'Unpublish' : 'Publish'}
        </Button>
      </div>
      <UserPostForm
        onSubmit={onSubmit}
        initialData={{
          title: post?.title ?? '',
          content: post?.content ?? [],
          coverImage: post?.coverImage ?? '',
          tags: post?.tags?.map(tag => tag.name) ?? [],
        }}
        isSubmitting={isPending}
      />
    </div>
  )
}
