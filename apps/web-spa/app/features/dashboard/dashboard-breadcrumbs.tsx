import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'

interface BreadcrumbItem {
  label: string
  to?: string
}

function useBreadcrumbs(): BreadcrumbItem[] {
  const { t } = useTranslation()
  const location = useLocation()
  const { userPostId } = useParams()
  const path = location.pathname

  if (path === '/dashboard') {
    return [{ label: t('breadcrumbs.dashboard') }]
  }

  if (path === '/dashboard/posts/new') {
    return [
      { label: t('breadcrumbs.dashboard'), to: '/dashboard' },
      { label: t('breadcrumbs.posts'), to: '/dashboard' },
      { label: t('breadcrumbs.newPost') },
    ]
  }

  if (userPostId && path.includes('/edit')) {
    return [
      { label: t('breadcrumbs.dashboard'), to: '/dashboard' },
      { label: t('breadcrumbs.posts'), to: '/dashboard' },
      { label: t('breadcrumbs.editPost') },
    ]
  }

  if (path === '/ai') {
    return [
      { label: t('breadcrumbs.dashboard'), to: '/dashboard' },
      { label: t('breadcrumbs.ai') },
    ]
  }

  if (path === '/components') {
    return [
      { label: t('breadcrumbs.dashboard'), to: '/dashboard' },
      { label: t('breadcrumbs.components') },
    ]
  }

  if (path === '/dashboard/profile') {
    return [
      { label: t('breadcrumbs.dashboard'), to: '/dashboard' },
      { label: t('breadcrumbs.profile') },
    ]
  }

  return [{ label: t('breadcrumbs.dashboard') }]
}

export function DashboardBreadcrumbs() {
  const breadcrumbs = useBreadcrumbs()

  if (breadcrumbs.length <= 1) {
    return (
      <nav aria-label="Breadcrumb">
        <span className="text-sm font-medium text-foreground">
          {breadcrumbs[0]?.label}
        </span>
      </nav>
    )
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1
          return (
            <li key={crumb.label} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  className="h-3 w-3 text-muted-foreground/60 shrink-0"
                  aria-hidden="true"
                />
              )}
              {crumb.to && !isLast
                ? (
                    <Link
                      to={crumb.to}
                      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {crumb.label}
                    </Link>
                  )
                : (
                    <span
                      className={
                        isLast
                          ? 'text-sm font-medium text-foreground'
                          : 'text-sm font-medium text-muted-foreground'
                      }
                      aria-current={isLast ? 'page' : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
