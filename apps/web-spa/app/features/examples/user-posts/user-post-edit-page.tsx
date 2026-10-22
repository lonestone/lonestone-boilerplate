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
import { postKeys, saveCoverImage } from './utils/user-posts-queries'
import UserPostForm, { UserPostFormSkeleton, type PostFormSubmitData } from './user-post-form'

export default function UserPostEditPage() {
  const { userPostId } = useParams()
  const { t } = useTranslation()

  const {
    data: post,
    isLoading,
    isError,
  } = useQuery({
    queryKey: postKeys.detail(userPostId),
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

  const { mutateAsync: updatePost, isPending } = useMutation({
    mutationFn: async (data: PostFormSubmitData) => {
      const response = await postControllerUpdatePost({
        body: {
          title: data.title,
          content: data.content,
          tags: data.tags,
        },
        path: {
          id: userPostId as string,
        },
      })

      if (response.error) {
        throw response.error
      }

      await saveCoverImage(userPostId as string, data.coverImage)
      return response.data
    },
    onSuccess: () => {
      toast.success(t('toasts.postUpdated'))
    },
    onError: () => {
      toast.error(t('toasts.postUpdateError'))
    },
    // The post may be saved even if its cover image failed.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.all })
    },
  })

  const { mutate: publishPost, isPending: isPublishing } = useMutation({
    mutationFn: async () => {
      const response = await postControllerPublishPost({
        path: { id: userPostId as string },
      })

      if (response.error) {
        throw response.error
      }

      return response.data
    },
    onSuccess: () => {
      toast.success(t('toasts.postPublished'))
      queryClient.invalidateQueries({ queryKey: postKeys.all })
    },
    onError: () => {
      toast.error(t('toasts.postPublishError'))
    },
  })

  const { mutate: unpublishPost, isPending: isUnpublishing } = useMutation({
    mutationFn: async () => {
      const response = await postControllerUnpublishPost({
        path: { id: userPostId as string },
      })

      if (response.error) {
        throw response.error
      }

      return response.data
    },
    onSuccess: () => {
      toast.success(t('toasts.postUnpublished'))
      queryClient.invalidateQueries({ queryKey: postKeys.all })
    },
    onError: () => {
      toast.error(t('toasts.postUnpublishError'))
    },
  })

  const onSubmit = async (data: PostFormSubmitData) => {
    await updatePost(data)
  }

  const onPublish = async () => {
    try {
      if (post?.publishedAt) {
        await unpublishPost()
      } else {
        await publishPost()
      }
    } catch (error) {
      console.error(error)
    }
  }

  if (isLoading) {
    return <UserPostFormSkeleton />
  }

  if (isError || !post) {
    return <p className="text-sm text-destructive">{t('posts.edit.loadError')}</p>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <p className="mb-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            {t('posts.title')}
          </p>
          <h1 className="font-sans text-3xl font-black tracking-tight text-foreground">
            {t('posts.edit.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('posts.edit.description')}</p>
        </div>
        <Button
          size="sm"
          onClick={onPublish}
          disabled={isPublishing || isUnpublishing || isPending}
        >
          <SendIcon className="size-4" />
          {post?.publishedAt ? t('posts.edit.unpublish') : t('posts.edit.publish')}
        </Button>
      </div>
      <UserPostForm
        onSubmit={onSubmit}
        initialData={{
          title: post?.title ?? '',
          content: post?.content ?? [],
          tags: post?.tags?.map((tag) => tag.name) ?? [],
        }}
        existingImageSrc={post?.coverImage?.url}
        isSubmitting={isPending}
      />
    </div>
  )
}
