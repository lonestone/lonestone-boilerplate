import type { CreatePostSchema } from '@boilerstone/openapi-generator'
import { postControllerCreatePost } from '@boilerstone/openapi-generator/client/sdk.gen'
import { toast } from '@boilerstone/ui/components/primitives/sonner'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import UserPostForm from './user-post-form'

export default function UserPostCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { mutate: createPost, isPending } = useMutation({
    mutationFn: (data: CreatePostSchema) =>
      postControllerCreatePost({
        body: data,
      }),
    onSuccess: async (result) => {
      if (!result.data) {
        toast.error(t('toasts.postCreateError'))
        return
      }
      toast.success(t('toasts.postCreated'))
      await new Promise(resolve => setTimeout(resolve, 800))
      navigate(`/dashboard/posts/${result.data.id}/edit`)
    },
    onError: (error) => {
      toast.error(error?.message || t('toasts.postCreateError'))
    },
  })

  const onSubmit = async (data: CreatePostSchema) => {
    await createPost(data)
  }

  return (
    <div>
      <div className="space-y-6 max-w-3xl">
        <div className="border-b border-border pb-6">
          <p className="mb-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            {t('posts.title')}
          </p>
          <h1 className="font-sans text-3xl font-black tracking-tight text-foreground">
            {t('posts.create.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('posts.create.description')}
          </p>
        </div>
        <UserPostForm onSubmit={onSubmit} isSubmitting={isPending} />
      </div>
    </div>
  )
}
