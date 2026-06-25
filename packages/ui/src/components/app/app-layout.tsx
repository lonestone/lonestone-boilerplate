import type { ReactNode } from 'react'
import { cn } from '@boilerstone/ui/lib/utils'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@boilerstone/ui/components/primitives/sidebar'
import { Separator } from '@boilerstone/ui/components/primitives/separator'

interface AppLayoutProps {
  sidebar: ReactNode
  header?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

/**
 * Generic app shell: collapsible sidebar + header + main content area.
 * Pass a `<Sidebar>` tree from primitives/sidebar as `sidebar`.
 *
 * @example
 * <AppLayout sidebar={<AppSidebar />}>
 *   <main>...</main>
 * </AppLayout>
 */
export function AppLayout({
  sidebar,
  header,
  children,
  defaultOpen = true,
  className,
}: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {sidebar}
      <SidebarInset className={cn('flex flex-col', className)}>
        {header !== undefined ? (
          <AppLayoutHeader>{header}</AppLayoutHeader>
        ) : null}
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}

interface AppLayoutHeaderProps {
  children?: ReactNode
  className?: string
  showTrigger?: boolean
}

export function AppLayoutHeader({
  children,
  className,
  showTrigger = true,
}: AppLayoutHeaderProps) {
  return (
    <header
      className={cn(
        'flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-sm transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12',
        className,
      )}
    >
      {showTrigger ? (
        <>
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            {children ? <Separator orientation="vertical" className="mr-2 h-4" /> : null}
          </div>
        </>
      ) : null}
      {children ? (
        <div className="flex flex-1 items-center gap-2 px-4">
          {children}
        </div>
      ) : null}
    </header>
  )
}
