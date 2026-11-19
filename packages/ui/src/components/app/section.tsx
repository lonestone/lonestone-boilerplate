import type { ReactNode } from 'react'
import { cn } from '@boilerstone/ui/lib/utils'

interface SectionProps {
  children: ReactNode
  className?: string
}

/**
 * A block inside a page. Not a route, and not a page title.
 * The comments list under an article is the reference.
 */
export function Section({ children, className }: SectionProps) {
  return <section className={cn('mt-8', className)}>{children}</section>
}

interface SectionHeaderProps {
  title: string
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

export function SectionHeader({ title, meta, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-6 flex items-center gap-2', className)}>
      <h2 className="text-2xl font-bold">{title}</h2>
      {meta}
      {actions ? <div className="ml-auto">{actions}</div> : null}
    </div>
  )
}
