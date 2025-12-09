import { Header } from '@boilerstone/ui/components/layout/Header'
import { Navigation } from '@boilerstone/ui/components/layout/Navigation'
import { LayoutDashboard, LogOut, MoonStar, PlusCircle, Settings, Sun, User } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Outlet, useNavigate } from 'react-router'
import useTheme from '@/hooks/useTheme'
import { authClient } from '@/lib/auth-client'

export default function DashboardPage() {
  const { data: sessionData, isPending } = authClient.useSession()
  const navigate = useNavigate()

  const [theme, setTheme] = useTheme()

  useEffect(() => {
    if (!isPending && !sessionData) {
      navigate('/login')
    }
  }, [sessionData, navigate, isPending])

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light')
  }

  const handleLogout = async () => {
    await authClient.signOut()
    navigate('/login')
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
              <span>Lonestone - Dashboard</span>
            </Link>
          )}
          sections={[
            {
              items: [
                { to: '/dashboard/posts/new', label: 'New Post', icon: <PlusCircle className="h-4 w-4" /> },
              ],
            },
            {
              separator: true,
              dropdown: {
                icon: <User className="h-4 w-4" />,
                label: 'User menu',
              },
              items: [
                { to: '/dashboard/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
                {
                  to: '#',
                  label: theme === 'dark' ? 'Light Mode' : 'Dark Mode',
                  icon: theme === 'dark' ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />,
                  onClick: () => handleThemeChange(!(theme === 'dark')),
                },
                {
                  to: '#',
                  label: 'Log out',
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
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Outlet />
      </main>
    </>
  )
}
