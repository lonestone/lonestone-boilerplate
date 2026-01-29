import { SUPPORTED_LOCALES } from '@boilerstone/i18n/config'
import { Header } from '@boilerstone/ui/components/layout/Header'
import { Navigation } from '@boilerstone/ui/components/layout/Navigation'
import { Languages, LayoutDashboard, LogOut, MoonStar, PlusCircle, Settings, Sun, User } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useNavigate } from 'react-router'
import useTheme from '@/hooks/useTheme'
import { authClient } from '@/lib/auth-client'
import { useI18nStore } from '@/lib/i18n/i18n-client'
import { AiChatStream } from './ai-chat-stream'

export default function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { data: sessionData, isPending } = authClient.useSession()
  const navigate = useNavigate()
  const { language, setLanguage } = useI18nStore()

  const [theme, setTheme] = useTheme()

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

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light')
  }

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

  return (
    <>
      <Header>
        <Navigation
          brand={(
            <Link
              to="/dashboard"
              className="flex items-center gap-2 font-bold hover:text-primary"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>{t('dashboard.brand')}</span>
            </Link>
          )}
          sections={[
            {
              items: [
                { to: '/dashboard/posts/new', label: t('dashboard.newPost'), icon: <PlusCircle className="h-4 w-4" /> },
              ],
            },
            {
              separator: true,
              dropdown: {
                icon: <Languages className="h-4 w-4" />,
                label: t('dashboard.language'),
              },
              items: Object.entries(SUPPORTED_LOCALES).map(([key, config]) => ({
                to: '#',
                label: `${config.flag} ${config.name}`,
                onClick: () => handleLanguageChange(key),
              })),
            },
            {
              separator: true,
              dropdown: {
                icon: <User className="h-4 w-4" />,
                label: t('dashboard.userMenu'),
              },
              items: [
                { to: '/dashboard/settings', label: t('dashboard.settings'), icon: <Settings className="h-4 w-4" /> },
                {
                  to: '#',
                  label: theme === 'dark' ? t('dashboard.lightMode') : t('dashboard.darkMode'),
                  icon: theme === 'dark' ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />,
                  onClick: () => handleThemeChange(!(theme === 'dark')),
                },
                {
                  to: '#',
                  label: t('dashboard.logOut'),
                  icon: <LogOut className="h-4 w-4" />,
                  onClick: handleLogout,
                  variant: 'destructive' as const,
                  separator: true,
                },
              ],
            },
          ]}
        />
      </Header>
      <main className="container mx-auto py-8 px-4 space-y-6">
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <AiChatStream />
        <Outlet />
      </main>
    </>
  )
}
