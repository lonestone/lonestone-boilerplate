import type { SupportedLocale } from '@pitchkit/i18n/config'
import { SUPPORTED_LOCALES } from '@pitchkit/i18n/config'
import { AppLayout, AppLayoutHeader, AppLoader } from '@pitchkit/ui/components/app'
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
} from '@pitchkit/ui/components/primitives/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@pitchkit/ui/components/primitives/dropdown-menu'
import { Avatar, AvatarFallback } from '@pitchkit/ui/components/primitives/avatar'
import { Toaster } from '@pitchkit/ui/components/primitives/sonner'
import {
  Bell,
  CalendarDays,
  ChevronUp,
  Command,
  Globe,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  User,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { ClubProvider, useClub } from '@/features/clubs/club-context'
import useTheme from '@/hooks/useTheme'
import { authClient } from '@/lib/auth-client'
import { useI18nStore } from '@/lib/i18n/i18n-client'
import RostiLogo from '@/assets/images/rosti-logo.svg'
import { CommandPalette } from './command-palette'
import { DashboardBreadcrumbs } from './dashboard-breadcrumbs'

function AppSidebar({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }) {
  const { t, i18n } = useTranslation()
  const { data: sessionData } = authClient.useSession()
  const { isClubAdmin } = useClub()
  const navigate = useNavigate()
  const location = useLocation()
  const { setLanguage } = useI18nStore()
  const [theme, setTheme] = useTheme()

  const handleLogout = async () => {
    await authClient.signOut()
    navigate('/login')
  }

  const handleLanguageChange = (locale: SupportedLocale) => {
    setLanguage(locale)
  }

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const userName = sessionData?.user?.name ?? sessionData?.user?.email ?? t('common.user')
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const navItems = [
    {
      label: t('nav.home'),
      to: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: t('nav.matches'),
      to: '/matches',
      icon: CalendarDays,
    },
    {
      label: t('nav.notifications'),
      to: '/notifications',
      icon: Bell,
    },
    ...(isClubAdmin
      ? [
          {
            label: t('nav.clubSettings'),
            to: '/club-settings',
            icon: Settings,
          },
        ]
      : []),
  ]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/dashboard" />}>
              <img
                src={RostiLogo}
                alt=""
                className="h-7 w-7 shrink-0 rounded-md object-contain"
              />
              <div className="flex flex-col leading-none">
                <span className="font-black tracking-tight text-foreground text-sm">
                  Rösti
                </span>
                <span className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase">
                  {t('dashboard.subtitle')}
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
              {navItems.map((item) => {
                const isActive =
                  item.to === '/dashboard'
                    ? location.pathname === '/dashboard'
                    : location.pathname.startsWith(item.to)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={isActive}
                      render={<Link to={item.to} />}
                      className={
                        isActive
                          ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                          : ''
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
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
              <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors outline-none">
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
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem render={<Link to="/dashboard/profile" />}>
                  <User className="mr-2 h-4 w-4" />
                  <span>{t('dashboard.profile')}</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleThemeToggle}>
                  {theme === 'dark' ? (
                    <Sun className="mr-2 h-4 w-4" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4" />
                  )}
                  <span>
                    {theme === 'dark' ? t('dashboard.lightMode') : t('dashboard.darkMode')}
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Globe className="mr-2 h-4 w-4" />
                    <span>{t('dashboard.language')}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {(Object.keys(SUPPORTED_LOCALES) as SupportedLocale[]).map((key) => {
                      const config = SUPPORTED_LOCALES[key]
                      return (
                        <DropdownMenuItem key={key} onClick={() => handleLanguageChange(key)}>
                          <span>
                            {config.flag} {config.name}
                          </span>
                          {i18n.language === key && (
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              {t('common.active')}
                            </span>
                          )}
                        </DropdownMenuItem>
                      )
                    })}
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
  const { data: sessionData, isPending } = authClient.useSession()
  const navigate = useNavigate()
  const [commandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    if (!isPending && !sessionData) {
      navigate('/login')
    }
  }, [sessionData, navigate, isPending])

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setCommandOpen((prev) => !prev)
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
    <ClubProvider>
      <AppLayout sidebar={<AppSidebar onOpenCommandPalette={() => setCommandOpen(true)} />}>
        <AppLayoutHeader>
          <DashboardBreadcrumbs />
        </AppLayoutHeader>
        <main className="flex min-h-0 flex-1 flex-col overflow-auto p-6">
          <Outlet />
        </main>
      </AppLayout>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

      <Toaster position="bottom-right" richColors />
    </ClubProvider>
  )
}
