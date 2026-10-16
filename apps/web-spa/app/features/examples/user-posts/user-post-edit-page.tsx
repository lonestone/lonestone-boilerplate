import type { UpdatePostSchema } from '@boilerstone/openapi-generator'
import { PageHeader } from '@boilerstone/ui/components/app/page'
import { Button } from '@boilerstone/ui/components/primitives/button'
import { toast } from '@boilerstone/ui/components/primitives/sonner'
import { SendIcon } from '@boilerstone/ui/icons'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import {
  usePublishUserPost,
  useUnpublishUserPost,
  useUpdateUserPost,
  useUserPost,
} from './hooks/use-user-posts'
import UserPostForm, { UserPostFormSkeleton } from './user-post-form'

export default function UserPostEditPage() {
  const { userPostId } = useParams()
  const { t } = useTranslation()
  const id = userPostId as string

  const { data: post, isLoading, isError } = useUserPost(id)

  const { mutate: updatePost, isPending } = useUpdateUserPost(id)
  const { mutate: publishPost, isPending: isPublishing } = usePublishUserPost(id)
  const { mutate: unpublishPost, isPending: isUnpublishing } = useUnpublishUserPost(id)

  const onSubmit = (data: UpdatePostSchema) => {
    updatePost(data, {
      onSuccess: () => toast.success(t('toasts.postUpdated')),
      onError: () => toast.error(t('toasts.postUpdateError')),
    })
  }

  const onPublish = () => {
    if (post?.publishedAt) {
      unpublishPost(undefined, {
        onSuccess: () => toast.success(t('toasts.postUnpublished')),
        onError: () => toast.error(t('toasts.postUnpublishError')),
      })
    } else {
      publishPost(undefined, {
        onSuccess: () => toast.success(t('toasts.postPublished')),
        onError: () => toast.error(t('toasts.postPublishError')),
      })
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
      <PageHeader
        variant="inset"
        eyebrow={t('posts.title')}
        title={t('posts.edit.title')}
        description={t('posts.edit.description')}
        actions={
          <Button
            size="sm"
            onClick={onPublish}
            disabled={isPublishing || isUnpublishing || isPending}
          >
            <SendIcon className="size-4" />
            {post?.publishedAt ? t('posts.edit.unpublish') : t('posts.edit.publish')}
          </Button>
        }
      />
      <UserPostForm
        onSubmit={onSubmit}
        initialData={{
          title: post?.title ?? '',
          content: post?.content ?? [],
          coverImage: post?.coverImage ?? '',
          tags: post?.tags?.map((tag) => tag.name) ?? [],
        }}
        isSubmitting={isPending}
      />
    </div>
  )
}
