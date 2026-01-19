import type { CreatePostSchema } from '@boilerstone/openapi-generator'
import { postControllerCreatePost } from '@boilerstone/openapi-generator/client/sdk.gen'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, Check, Settings } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import UserPostForm from './user-post-form'

export default function UserPostCreatePage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<
    'idle' | 'processing' | 'success' | 'error'
  >('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const navigate = useNavigate()

  const { mutate: createPost, isPending } = useMutation({
    mutationFn: (data: CreatePostSchema) =>
      postControllerCreatePost({
        body: data,
      }),
    onSuccess: async (result) => {
      if (!result.data) {
        setStatus('error')
        setErrorMessage(t('posts.create.error'))
        return
      }
      setStatus('success')
      await new Promise(resolve => setTimeout(resolve, 800))
      navigate(`/dashboard/posts/${result.data.id}/edit`)
    },
    onError: (error) => {
      setStatus('error')
      setErrorMessage(
        error?.message || t('posts.create.error'),
      )
    },
  })

  const onSubmit = async (data: CreatePostSchema) => {
    setStatus('processing')
    setErrorMessage('')
    await createPost(data)
  }

  return (
    <div>
      <div className="space-y-4 max-w-3xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{t('posts.create.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('posts.create.description')}
            </p>
          </div>
          <div className="flex justify-start items-center gap-3">
            {status !== 'idle' && (
              <div className="flex gap-2 bg-card px-3 py-1.5 rounded-md shadow-sm animate-in fade-in duration-300">
                {status === 'processing'
                  ? (
                      <>
                        <Settings className="size-4 text-muted-foreground animate-spin" />
                        <span className="text-sm text-muted-foreground">
                          {t('posts.create.creating')}
                        </span>
                      </>
                    )
                  : status === 'success'
                    ? (
                        <>
                          <Check className="size-4 text-primary" />
                          <span className="text-sm text-primary">{t('posts.create.created')}</span>
                        </>
                      )
                    : (
                        <>
                          <AlertCircle className="size-4 text-destructive" />
                          <span className="text-sm text-destructive">
                            {errorMessage}
                          </span>
                        </>
                      )}
              </div>
            )}
          </div>
        </div>
        <UserPostForm onSubmit={onSubmit} isSubmitting={isPending} />
      </div>
    </div>
  )
}
