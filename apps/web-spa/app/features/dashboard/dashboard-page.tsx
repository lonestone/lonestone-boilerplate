import { Header } from '@boilerstone/ui/components/layout/Header'
import { Navigation } from '@boilerstone/ui/components/layout/Navigation'
import { Button } from '@boilerstone/ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@boilerstone/ui/components/primitives/dropdown-menu'
import { Switch } from '@boilerstone/ui/components/primitives/switch'
import { LayoutDashboard, LogOut, MoonStar, PlusCircle, Settings, Sun, User, UserIcon } from 'lucide-react'
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
              items: [
                { to: '/dashboard/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
                {
                  to: '#',
                  label: theme === 'dark' ? 'Light Mode' : 'Dark Mode',
                  icon: theme === 'dark' ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />,
                  onClick: () => handleThemeChange(!(theme === 'dark')),
                },
              ],
            },
            {
              separator: true,
              items: [
                {
                  to: '#',
                  label: 'Log out',
                  icon: <LogOut className="h-4 w-4" />,
                  onClick: handleLogout,
                  variant: 'destructive' as const,
                },
              ],
            },
          ]}
          desktopActions={(
            <>
              <Button variant="outline" size="sm" asChild>
                <Link
                  to="/dashboard/posts/new"
                  className="flex items-center gap-2"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>New Post</span>
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative h-8 w-8 rounded-md"
                  >
                    <User className="h-4 w-4" />
                    <span className="sr-only">Open user menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    My Account
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link
                      to="/dashboard/settings"
                      className="flex w-full items-center"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild onSelect={e => e.preventDefault()}>
                    <div className="flex items-center gap-2">
                      <Sun className={theme === 'dark' ? 'text-foreground/50' : 'text-foreground'} />
                      <Switch
                        checked={theme === 'dark'}
                        onCheckedChange={handleThemeChange}
                      />
                      <MoonStar className={theme === 'light' ? 'text-foreground/50' : 'text-foreground'} />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center text-destructive-foreground hover:bg-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        />
      </Header>
      <main className="container mx-auto py-8 px-4 space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Outlet />
      </main>
    </>
  )
}
