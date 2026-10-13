import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { cn } from '@boilerstone/ui/lib/utils'

type PageVariant = 'band' | 'inset'

const PageVariantContext = createContext<PageVariant>('inset')

interface PageProps {
  variant?: PageVariant
  children: ReactNode
  className?: string
}

/**
 * One screen inside a shell. `band` is a public page (full-width title, contained body).
 * `inset` is a row inside the dashboard. The header reads the same variant.
 */
export function Page({ variant = 'inset', children, className }: PageProps) {
  return (
    <PageVariantContext.Provider value={variant}>
      <div className={className}>{children}</div>
    </PageVariantContext.Provider>
  )
}

interface PageHeaderProps {
  variant?: PageVariant
  eyebrow?: string
  title: string
  description?: ReactNode
  before?: ReactNode
  leading?: ReactNode
  actions?: ReactNode
  className?: string
}

function renderDescription(description: ReactNode, className: string) {
  if (description == null || description === false) {
    return null
  }
  if (typeof description === 'string' || typeof description === 'number') {
    return <p className={className}>{description}</p>
  }
  return description
}

export function PageHeader({
  variant,
  eyebrow,
  title,
  description,
  before,
  leading,
  actions,
  className,
}: PageHeaderProps) {
  const pageVariant = useContext(PageVariantContext)
  const resolved = variant ?? pageVariant

  if (resolved === 'inset') {
    return (
      <div className={cn('flex items-end justify-between border-b border-border pb-6', className)}>
        <div>
          {eyebrow ? (
            <p className="mb-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-sans text-3xl font-black tracking-tight text-foreground">{title}</h1>
          {renderDescription(description, 'mt-1 text-sm text-muted-foreground')}
        </div>
        {actions}
      </div>
    )
  }

  return (
    <div className={cn('border-b border-border/60 bg-background', className)}>
      <div className="container mx-auto px-4 py-12 md:px-6 md:py-16">
        {before}
        {leading ? (
          <div className="flex items-start gap-5">
            {leading}
            <div className="min-w-0">
              {eyebrow ? (
                <p className="mb-0.5 text-xs font-medium tracking-widest text-muted-foreground uppercase">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="mb-1 font-sans text-3xl font-black tracking-tight text-foreground md:text-4xl">
                {title}
              </h1>
              {renderDescription(description, 'text-sm text-muted-foreground')}
            </div>
            {actions}
          </div>
        ) : (
          <>
            {eyebrow ? (
              <p className="mb-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
                {eyebrow}
              </p>
            ) : null}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="font-sans text-4xl font-black tracking-tight text-foreground md:text-5xl">
                  {title}
                </h1>
                {renderDescription(description, 'mt-1 text-sm text-muted-foreground')}
              </div>
              {actions}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface PageBodyProps {
  children: ReactNode
  className?: string
}

export function PageBody({ children, className }: PageBodyProps) {
  const variant = useContext(PageVariantContext)
  return (
    <div
      className={cn(
        variant === 'band' && 'container mx-auto px-4 py-8 md:px-6 md:py-10',
        className,
      )}
    >
      {children}
    </div>
  )
}
