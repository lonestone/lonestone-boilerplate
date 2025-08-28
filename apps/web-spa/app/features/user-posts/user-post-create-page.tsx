import type {
  CreatePostSchema,
} from '@lonestone/openapi-generator'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, Check, Settings } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { apiClient } from '@/lib/api-client'
import UserPostForm from './user-post-form'

export default function UserPostCreatePage() {
  const [status, setStatus] = useState<
    'idle' | 'processing' | 'success' | 'error'
  >('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const navigate = useNavigate()

  const { mutate: createPost, isPending } = useMutation({
    mutationFn: (data: CreatePostSchema) =>
      apiClient.postControllerCreatePost({
        body: data,
      }),
    onSuccess: async (result) => {
      if (!result.data?.id) {
        setStatus('error')
        setErrorMessage('Post created but no ID returned')
        return
      }
      setStatus('success')
      await new Promise(resolve => setTimeout(resolve, 800))
      navigate(`/dashboard/posts/${result.data.id}/edit`)
    },
    onError: (error) => {
      setStatus('error')
      setErrorMessage(
        error?.message || 'An error occurred while creating the post',
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
            <h1 className="text-2xl font-bold">Create New Post</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Share your thoughts, images, and videos with the world.
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
                          Creating...
                        </span>
                      </>
                    )
                  : status === 'success'
                    ? (
                        <>
                          <Check className="size-4 text-primary" />
                          <span className="text-sm text-primary">Created!</span>
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
