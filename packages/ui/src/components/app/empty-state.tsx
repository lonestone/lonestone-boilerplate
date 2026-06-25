import type { ReactNode } from 'react'
import { cn } from '@boilerstone/ui/lib/utils'
import { Button } from '@boilerstone/ui/components/primitives/button'

interface EmptyStateAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
  className?: string
}

/**
 * Generic empty-state placeholder used when a list or page has no data.
 *
 * @example
 * <EmptyState
 *   icon={<InboxIcon className="size-6 text-muted-foreground" />}
 *   title="No items yet"
 *   description="Create your first item to get started."
 *   action={{ label: 'Create item', onClick: handleCreate }}
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 p-3 rounded-full bg-muted">{icon}</div>
      ) : null}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description ? (
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">{description}</p>
      ) : null}
      {action ? (
        <Button onClick={action.onClick} variant={action.variant ?? 'default'}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
