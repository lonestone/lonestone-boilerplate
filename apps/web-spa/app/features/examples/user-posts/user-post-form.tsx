import { Button } from '@boilerstone/ui/components/primitives/button'
import { Input } from '@boilerstone/ui/components/primitives/input'
import { Skeleton } from '@boilerstone/ui/components/primitives/skeleton'
import { cn } from '@boilerstone/ui/lib/utils'
import { Image, Loader2, MoveDown, MoveUp, Plus, Trash2, Type, Video, X } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

interface PostContentItem {
  type: 'text' | 'image' | 'video'
  data: string
}

interface PostFormData {
  title: string
  content: PostContentItem[]
  coverImage?: string
  tags?: string[]
}

interface UserPostFormProps {
  onSubmit: (data: PostFormData) => Promise<void>
  initialData?: PostFormData
  isSubmitting?: boolean
}

export default function UserPostForm({
  onSubmit,
  initialData,
  isSubmitting = false,
}: UserPostFormProps) {
  const { t } = useTranslation()
  const [activeContentType, setActiveContentType] = useState<'text' | 'image' | 'video'>('text')

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PostFormData>({
    defaultValues: initialData || {
      title: '',
      content: [{ type: 'text', data: '' }],
      coverImage: '',
      tags: [],
    },
  })

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'content',
  })

  const handleFormSubmit = async (data: PostFormData) => {
    try {
      await onSubmit({
        ...data,
        coverImage: data.coverImage?.trim() ? data.coverImage.trim() : undefined,
        tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
      })
    } catch (error) {
      console.error('Error submitting form:', error)
    }
  }

  const addContentItem = () => {
    append({ type: activeContentType, data: '' })
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="title" className="block text-sm font-medium">
            {t('posts.form.title')}
          </label>
          <Input
            id="title"
            placeholder={t('posts.form.titlePlaceholder')}
            className="w-full"
            {...register('title', {
              required: t('posts.form.titleRequired'),
              minLength: {
                value: 3,
                message: t('posts.form.titleMinLength'),
              },
            })}
          />
          {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="coverImage" className="block text-sm font-medium">
            {t('posts.form.coverImage')}
          </label>
          <Input
            id="coverImage"
            type="url"
            placeholder={t('posts.form.coverImagePlaceholder')}
            className="w-full"
            {...register('coverImage')}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="tags" className="block text-sm font-medium">
            {t('posts.form.tags')}
          </label>
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <Input
                id="tags"
                placeholder={t('posts.form.tagsPlaceholder')}
                className="w-full"
                value={(field.value ?? []).join(', ')}
                onChange={(event) =>
                  field.onChange(
                    event.target.value
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  )
                }
              />
            )}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">{t('posts.form.content')}</label>
            <div className="flex items-center space-x-2">
              <div className="bg-muted rounded-md p-1 flex">
                <button
                  type="button"
                  onClick={() => setActiveContentType('text')}
                  className={cn(
                    'p-1.5 rounded-md flex items-center justify-center',
                    activeContentType === 'text'
                      ? 'bg-background shadow-sm'
                      : 'hover:bg-background/50',
                  )}
                >
                  <Type className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveContentType('image')}
                  className={cn(
                    'p-1.5 rounded-md flex items-center justify-center',
                    activeContentType === 'image'
                      ? 'bg-background shadow-sm'
                      : 'hover:bg-background/50',
                  )}
                >
                  <Image className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveContentType('video')}
                  className={cn(
                    'p-1.5 rounded-md flex items-center justify-center',
                    activeContentType === 'video'
                      ? 'bg-background shadow-sm'
                      : 'hover:bg-background/50',
                  )}
                >
                  <Video className="size-4" />
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addContentItem}
                className="flex items-center gap-1"
              >
                <Plus className="size-3.5" />
                {t('posts.form.addContent', { type: activeContentType })}
              </Button>
            </div>
          </div>

          {fields.length === 0 && (
            <div className="text-center py-8 border border-dashed rounded-md">
              <p className="text-muted-foreground">{t('posts.form.contentEmpty')}</p>
            </div>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-md p-4 relative bg-card">
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => move(index, index - 1)}
                      className="size-7"
                    >
                      <MoveUp className="size-3.5" />
                    </Button>
                  )}
                  {index < fields.length - 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => move(index, index + 1)}
                      className="size-7"
                    >
                      <MoveDown className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="size-7 text-destructive hover:text-destructive/90"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                <div className="mb-3 flex items-center gap-2">
                  {field.type === 'text' && <Type className="size-4" />}
                  {field.type === 'image' && <Image className="size-4" />}
                  {field.type === 'video' && <Video className="size-4" />}
                  <span className="text-sm font-medium capitalize">
                    {t('posts.form.contentLabel', { type: field.type })}
                  </span>
                </div>

                <Controller
                  control={control}
                  name={`content.${index}.type`}
                  render={({ field }) => <input type="hidden" {...field} />}
                />

                <Controller
                  control={control}
                  name={`content.${index}.data`}
                  rules={{
                    required: t('posts.form.contentRequired', { type: field.type }),
                  }}
                  render={({ field: controllerField, fieldState }) => (
                    <div>
                      {field.type === 'text' && (
                        <div className="space-y-1">
                          <textarea
                            {...controllerField}
                            placeholder={t('posts.form.textPlaceholder')}
                            className={cn(
                              'border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[120px] resize-y',
                              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                              'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
                              fieldState.error && 'border-destructive',
                            )}
                          />
                          {fieldState.error && (
                            <p className="text-sm text-destructive">{fieldState.error.message}</p>
                          )}
                        </div>
                      )}

                      {field.type === 'image' && (
                        <div className="space-y-1">
                          <Input
                            {...controllerField}
                            placeholder={t('posts.form.imagePlaceholder')}
                            className={cn(fieldState.error && 'border-destructive')}
                          />
                          {fieldState.error && (
                            <p className="text-sm text-destructive">{fieldState.error.message}</p>
                          )}
                          {controllerField.value && (
                            <div className="mt-2 relative rounded-md overflow-hidden border">
                              <img
                                src={controllerField.value}
                                alt={t('posts.form.imagePreviewAlt')}
                                className="max-h-[200px] w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src =
                                    'https://placehold.co/600x400?text=Invalid+Image+URL'
                                }}
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 size-7 opacity-80 hover:opacity-100"
                                onClick={() => controllerField.onChange('')}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {field.type === 'video' && (
                        <div className="space-y-1">
                          <Input
                            {...controllerField}
                            placeholder={t('posts.form.videoPlaceholder')}
                            className={cn(fieldState.error && 'border-destructive')}
                          />
                          {fieldState.error && (
                            <p className="text-sm text-destructive">{fieldState.error.message}</p>
                          )}
                          {controllerField.value && (
                            <div className="mt-2 p-2 bg-muted/50 rounded-md">
                              <p className="text-sm">
                                {t('posts.form.videoUrl')} {controllerField.value}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <Button type="submit" className="w-full" disabled={isSubmitting} id="button">
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {t('posts.form.saving')}
              </span>
            ) : (
              t('posts.form.save')
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function UserPostFormSkeleton() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-4">
          {Array.from({ length: 1 }).map((_, index) => (
            // oxlint-disable-next-line react/no-array-index-key
            <div key={`skeleton-${index}`} className="space-y-2 border rounded-md p-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>

        <Skeleton className="h-10 w-40 mt-4" />
      </div>

      <div className="flex justify-end">
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}
