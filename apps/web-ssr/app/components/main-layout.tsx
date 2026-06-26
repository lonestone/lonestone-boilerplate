import { cn } from '@boilerstone/ui/lib/utils'
import { Moon, Sun } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { useTheme } from '@/hooks/use-theme'

function ThemeToggle() {
  const [theme, setTheme] = useTheme()

  return (
    <button
      type="button"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/posts', label: 'Journal' },
]

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 md:px-6">
          {/* Wordmark */}
          <Link
            to="/"
            className="group flex items-center gap-2 font-sans text-base font-black tracking-tight text-foreground transition-opacity hover:opacity-80"
          >
            <span className="inline-block h-5 w-5 rounded-sm bg-primary" aria-hidden="true" />
            LONESTONE
          </Link>

          {/* Right: nav links grouped with the theme toggle */}
          <div className="flex items-center gap-1">
            <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
              {navLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="ml-1 border-l border-border/60 pl-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border/60 bg-background">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-10 md:flex-row md:px-6">
          <div className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-sm bg-primary" aria-hidden="true" />
            <span className="text-sm font-black tracking-tight text-foreground">LONESTONE</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Built with the Lonestone boilerplate.
          </p>
          <nav className="flex gap-4" aria-label="Footer navigation">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
