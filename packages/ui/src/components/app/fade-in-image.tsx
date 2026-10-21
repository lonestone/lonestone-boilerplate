import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@boilerstone/ui/lib/utils'
import { useCallback, useState } from 'react'

type ImageStatus = 'loading' | 'loaded' | 'error'

interface FadeInImageProps extends Omit<ComponentProps<'img'>, 'src' | 'ref' | 'onLoad' | 'onError'> {
  src?: string | null
  alt: string
  /** Rendered when there is no `src` or the image fails to load. */
  fallback?: ReactNode
  /** Classes applied while the image is loading. */
  loadingClassName?: string
  /** Classes applied once the image is loaded. */
  loadedClassName?: string
}

/**
 * Image that fades in once loaded, and shows a fallback when missing or broken.
 *
 * Safe with server-side rendering: an image that finished loading before hydration
 * never fires `onLoad` in React, so the ref checks `img.complete` on mount.
 *
 * @example
 * <FadeInImage
 *   src={post.coverImage?.url}
 *   alt={post.title}
 *   className="h-full w-full object-cover"
 *   fallback={<span>{post.title.slice(0, 2)}</span>}
 * />
 */
export function FadeInImage({
  src,
  alt,
  fallback = null,
  className,
  loadingClassName = 'opacity-0 blur-sm',
  loadedClassName = 'opacity-100 blur-0',
  ...props
}: FadeInImageProps) {
  const [state, setState] = useState<{ src?: string | null, status: ImageStatus }>({
    src,
    status: 'loading',
  })
  // Reset to loading when `src` changes (signed URLs change on every fetch)
  const status = state.src === src ? state.status : 'loading'

  const imgRef = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete) {
        setState({ src, status: img.naturalWidth > 0 ? 'loaded' : 'error' })
      }
    },
    [src],
  )

  if (!src || status === 'error') {
    return fallback
  }

  return (
    <img
      {...props}
      ref={imgRef}
      src={src}
      alt={alt}
      onLoad={() => setState({ src, status: 'loaded' })}
      onError={() => setState({ src, status: 'error' })}
      className={cn(
        'transform-gpu transition-all duration-700',
        className,
        status === 'loaded' ? loadedClassName : loadingClassName,
      )}
    />
  )
}
