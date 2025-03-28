import { authClient } from '@/lib/auth-client'
import { Header } from '@lonestone/ui/components/layout/Header'
import { Button } from '@lonestone/ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@lonestone/ui/components/primitives/dropdown-menu'
import {
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Settings,
  User,
} from 'lucide-react'
import { useEffect } from 'react'
import { Link, Outlet, useNavigate } from 'react-router'

export default function DashboardPage() {
  const { data: sessionData, isPending } = authClient.useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isPending && !sessionData) {
      navigate('/login')
    }
  }, [sessionData, navigate, isPending])

  return (
    <>
      <Header>
        <div className="container mx-auto flex h-14 items-center justify-between gap-8 px-4">
          <div className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 font-bold hover:text-primary"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Lonestone - Dashboard</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
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
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    to="/dashboard/settings"
                    className="flex w-full items-center"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex items-center text-destructive-foreground hover:bg-destructive"
                  onClick={async () => {
                    await authClient.signOut()
                    navigate('/login')
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Header>
      <main className="container mx-auto py-8 px-4 space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Outlet />
      </main>
    </>
  )
}
