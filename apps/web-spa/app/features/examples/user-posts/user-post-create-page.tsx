import type { CreatePostSchema } from '@boilerstone/openapi-generator'
import { toast } from '@boilerstone/ui/components/primitives/sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useCreateUserPost } from './hooks/use-user-posts'
import UserPostForm from './user-post-form'

export default function UserPostCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { mutate: createPost, isPending } = useCreateUserPost()

  const onSubmit = (data: CreatePostSchema) => {
    createPost(data, {
      onSuccess: async (post) => {
        toast.success(t('toasts.postCreated'))
        await new Promise((resolve) => setTimeout(resolve, 800))
        navigate(`/dashboard/posts/${post.id}/edit`)
      },
      onError: (error) => {
        toast.error(error?.message || t('toasts.postCreateError'))
      },
    })
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
          <p className="mt-1 text-sm text-muted-foreground">{t('posts.create.description')}</p>
        </div>
        <UserPostForm onSubmit={onSubmit} isSubmitting={isPending} />
      </div>
    </div>
  )
}
