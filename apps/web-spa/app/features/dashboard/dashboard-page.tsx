import { SUPPORTED_LOCALES } from '@boilerstone/i18n/config'
import { AppLayout, AppLayoutHeader, AppLoader } from '@boilerstone/ui/components/app'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@boilerstone/ui/components/primitives/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@boilerstone/ui/components/primitives/dropdown-menu'
import { Avatar, AvatarFallback } from '@boilerstone/ui/components/primitives/avatar'
import { Toaster } from '@boilerstone/ui/components/primitives/sonner'
import { Brain, ChevronUp, Command, Component, Globe, LayoutDashboard, LogOut, Moon, Pen, PlusCircle, Sun, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import useTheme from '@/hooks/useTheme'
import { authClient } from '@/lib/auth-client'
import { useI18nStore } from '@/lib/i18n/i18n-client'
import { CommandPalette } from './command-palette'
import { DashboardBreadcrumbs } from './dashboard-breadcrumbs'

function AppSidebar({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }) {
  const { t, i18n } = useTranslation()
  const { data: sessionData } = authClient.useSession()
  const navigate = useNavigate()
  const { setLanguage } = useI18nStore()
  const [theme, setTheme] = useTheme()

  const handleLogout = async () => {
    await authClient.signOut()
    navigate('/login')
  }

  const handleLanguageChange = (locale: string) => {
    const localeConfig = SUPPORTED_LOCALES[locale as keyof typeof SUPPORTED_LOCALES]
    if (localeConfig) {
      setLanguage(localeConfig.defaultLocale)
    }
  }

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const userName = sessionData?.user?.name ?? sessionData?.user?.email ?? 'User'
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const navItems = [
    {
      label: t('dashboard.title'),
      to: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: t('dashboard.ai'),
      to: '/ai',
      icon: Brain,
    },
    {
      label: t('dashboard.components'),
      to: '/components',
      icon: Component,
    },
  ]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/dashboard" />}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
                <Pen className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-black tracking-tight text-foreground uppercase text-sm">
                  Lonestone
                </span>
                <span className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase">
                  Dashboard
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground">
            {t('dashboard.navigation')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => (
                <SidebarMenuItem key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/dashboard'}
                    className={({ isActive }) =>
                      isActive
                        ? 'flex w-full items-center gap-2 rounded-md bg-primary px-2 py-1.5 text-sm font-medium text-primary-foreground transition-colors'
                        : 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors'
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground">
            {t('dashboard.actions')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link to="/dashboard/posts/new" />}>
                  <PlusCircle className="h-4 w-4" />
                  <span>{t('dashboard.newPost')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {/* Command palette trigger */}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onOpenCommandPalette}>
                  <Command className="h-4 w-4" />
                  <span className="flex-1">{t('commandPalette.title')}</span>
                  <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground opacity-100">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors outline-none"
              >
                <Avatar size="sm">
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col items-start leading-none overflow-hidden">
                  <span className="truncate text-xs font-semibold text-sidebar-foreground">
                    {userName}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {sessionData?.user?.email}
                  </span>
                </div>
                <ChevronUp className="ml-auto size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-56"
              >
                <DropdownMenuItem render={<Link to="/dashboard/profile" />}>
                  <User className="mr-2 h-4 w-4" />
                  <span>{t('dashboard.profile')}</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleThemeToggle}>
                  {theme === 'dark'
                    ? <Sun className="mr-2 h-4 w-4" />
                    : <Moon className="mr-2 h-4 w-4" />}
                  <span>{theme === 'dark' ? t('dashboard.lightMode') : t('dashboard.darkMode')}</span>
                </DropdownMenuItem>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Globe className="mr-2 h-4 w-4" />
                    <span>{t('dashboard.language')}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {Object.entries(SUPPORTED_LOCALES).map(([key, config]) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => handleLanguageChange(key)}
                      >
                        <span>
                          {config.flag}
                          {' '}
                          {config.name}
                        </span>
                        {i18n.language === config.defaultLocale && (
                          <span className="ml-auto text-[10px] text-muted-foreground">Active</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('dashboard.logOut')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export default function DashboardPage() {
  const { i18n } = useTranslation()
  const { data: sessionData, isPending } = authClient.useSession()
  const navigate = useNavigate()
  const { language } = useI18nStore()
  const [commandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    if (!isPending && !sessionData) {
      navigate('/login')
    }
  }, [sessionData, navigate, isPending])

  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language)
    }
  }, [language, i18n])

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setCommandOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (isPending) {
    return <AppLoader />
  }

  if (!sessionData) {
    return null
  }

  return (
    <>
      <AppLayout sidebar={<AppSidebar onOpenCommandPalette={() => setCommandOpen(true)} />}>
        <AppLayoutHeader>
          <DashboardBreadcrumbs />
        </AppLayoutHeader>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </AppLayout>

      {/* Command palette — global overlay */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Single Toaster mount for the entire dashboard */}
      <Toaster position="bottom-right" richColors />
    </>
  )
}
