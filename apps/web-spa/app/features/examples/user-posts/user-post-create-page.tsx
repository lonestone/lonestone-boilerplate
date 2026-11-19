import { PageHeader } from '@boilerstone/ui/components/app/page'
import { toast } from '@boilerstone/ui/components/primitives/sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useCreateUserPost, useSaveUserPostCoverImage } from './hooks/use-user-posts'
import UserPostForm, { type PostFormSubmitData } from './user-post-form'

export default function UserPostCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { mutate: createPost, isPending: isCreating } = useCreateUserPost()
  const { mutateAsync: saveCoverImage, isPending: isSavingCoverImage } = useSaveUserPostCoverImage()

  const onSubmit = ({ coverImage, ...body }: PostFormSubmitData) => {
    createPost(body, {
      onSuccess: async (post) => {
        // The post exists at this point: an image failure must not hide it.
        if (coverImage !== undefined) {
          try {
            await saveCoverImage({ id: post.id, coverImage })
          } catch {
            toast.error(t('toasts.postCoverImageError'))
          }
        }
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
        <PageHeader
          variant="inset"
          eyebrow={t('posts.title')}
          title={t('posts.create.title')}
          description={t('posts.create.description')}
        />
        <UserPostForm onSubmit={onSubmit} isSubmitting={isCreating || isSavingCoverImage} />
      </div>
    </div>
  )
}
