import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@boilerstone/ui/components/primitives/command'
import { Brain, Component, LayoutDashboard, Moon, PlusCircle, Sun, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import useTheme from '@/hooks/useTheme'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [theme, setTheme] = useTheme()

  const handleNavigate = (to: string) => {
    onOpenChange(false)
    navigate(to)
  }

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
    onOpenChange(false)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('commandPalette.title')}
      description={t('commandPalette.description')}
    >
      <Command>
        <CommandInput placeholder={t('commandPalette.placeholder')} />
        <CommandEmpty>{t('commandPalette.noResults')}</CommandEmpty>

        <CommandGroup heading={t('commandPalette.groups.navigate')}>
          <CommandItem
            onSelect={() => handleNavigate('/dashboard')}
            keywords={['dashboard', 'home', 'overview']}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>{t('commandPalette.items.dashboard')}</span>
            <CommandShortcut>D</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleNavigate('/ai')}
            keywords={['ai', 'playground', 'chat', 'artificial intelligence']}
          >
            <Brain className="h-4 w-4" />
            <span>{t('commandPalette.items.ai')}</span>
            <CommandShortcut>A</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleNavigate('/components')}
            keywords={['components', 'ui', 'gallery', 'library']}
          >
            <Component className="h-4 w-4" />
            <span>{t('commandPalette.items.components')}</span>
            <CommandShortcut>C</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => handleNavigate('/dashboard/profile')}
            keywords={['profile', 'account', 'user', 'settings']}
          >
            <User className="h-4 w-4" />
            <span>{t('commandPalette.items.profile')}</span>
            <CommandShortcut>P</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t('commandPalette.groups.actions')}>
          <CommandItem
            onSelect={() => handleNavigate('/dashboard/posts/new')}
            keywords={['new', 'create', 'post', 'write', 'article']}
          >
            <PlusCircle className="h-4 w-4" />
            <span>{t('commandPalette.items.newPost')}</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t('commandPalette.groups.preferences')}>
          <CommandItem
            onSelect={handleToggleTheme}
            keywords={['theme', 'dark', 'light', 'mode']}
          >
            {theme === 'dark'
              ? <Sun className="h-4 w-4" />
              : <Moon className="h-4 w-4" />}
            <span>
              {theme === 'dark'
                ? t('commandPalette.items.lightMode')
                : t('commandPalette.items.darkMode')}
            </span>
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </Command>
    </CommandDialog>
  )
}
