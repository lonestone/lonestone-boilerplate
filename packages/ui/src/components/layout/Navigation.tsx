import { Button } from '@boilerstone/ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@boilerstone/ui/components/primitives/dropdown-menu'
import { Separator } from '@boilerstone/ui/components/primitives/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@boilerstone/ui/components/primitives/sheet'
import { cn } from '@boilerstone/ui/lib/utils'
import { Menu } from 'lucide-react'
import * as React from 'react'
import { Link, NavLink } from 'react-router'

export interface NavigationItem {
  to: string
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  variant?: 'default' | 'destructive'
  separator?: boolean
  hideOnMobile?: boolean
  hideOnDesktop?: boolean
}

export interface NavigationSection {
  items: NavigationItem[]
  separator?: boolean
  position?: 'left' | 'center' | 'right'
  dropdown?: {
    icon: React.ReactNode
    label?: string
  }
}

interface NavigationItemProps {
  item: NavigationItem
  isMobile?: boolean
  onItemClick?: () => void
  className?: string
}

function NavigationItemComponent({ item, className, isMobile = false, onItemClick }: NavigationItemProps) {
  const baseClassName = cn(
    className,
    'flex items-center gap-2 px-3 py-2 rounded-md transition-colors',
    isMobile && 'w-full text-left',
    !isMobile && 'text-sm',
    item.variant === 'destructive' && 'text-destructive hover:bg-destructive hover:text-destructive-foreground',
    item.variant !== 'destructive' && 'hover:bg-accent hover:text-accent-foreground',
  )

  if (item.onClick) {
    return (
      <button
        type="button"
        onClick={() => {
          item.onClick?.()
          onItemClick?.()
        }}
        className={baseClassName}
      >
        {item.icon}
        <span>{item.label}</span>
      </button>
    )
  }

  if (isMobile) {
    return (
      <Link
        to={item.to}
        onClick={onItemClick}
        className={baseClassName}
      >
        {item.icon}
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => cn(
        baseClassName,
        isActive && 'text-primary font-medium bg-primary/10',
      )}
    >
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  )
}
NavigationItemComponent.displayName = 'NavigationItem'

interface NavigationSectionProps {
  section: NavigationSection
  isMobile?: boolean
  onItemClick?: () => void
}

function NavigationSectionComponent({ section, isMobile = false, onItemClick }: NavigationSectionProps) {
  const visibleItems = section.items.filter(item =>
    isMobile ? !item.hideOnMobile : !item.hideOnDesktop,
  )
  const sectionKey = visibleItems.map(item => item.to).join('-')

  if (visibleItems.length === 0) {
    return null
  }

  return (
    <div key={sectionKey} className="flex flex-col gap-2">
      {visibleItems.map((item, index) => (
        <React.Fragment key={item.to}>
          {item.separator && index > 0 && <Separator className="my-2" />}
          <NavigationItemComponent
            item={item}
            isMobile={isMobile}
            onItemClick={onItemClick}
          />
        </React.Fragment>
      ))}
    </div>
  )
}
NavigationSectionComponent.displayName = 'NavigationSection'

interface NavigationDropdownProps {
  section: NavigationSection
}

function NavigationDropdown({ section }: NavigationDropdownProps) {
  const visibleItems = section.items.filter(item => !item.hideOnDesktop)

  if (!section.dropdown || visibleItems.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-8 w-8 rounded-md">
          {section.dropdown.icon}
          {section.dropdown.label && <span className="sr-only">{section.dropdown.label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {visibleItems.map((item, index) => (
          <React.Fragment key={item.to}>
            {item.separator && index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              asChild={!item.onClick}
              onClick={item.onClick}
              className={cn(
                'flex items-center gap-2',
                item.variant === 'destructive' && 'text-destructive hover:bg-destructive hover:text-destructive-foreground',
              )}
            >
              {item.onClick
                ? (
                    <>
                      {item.icon}
                      <span>{item.label}</span>
                    </>
                  )
                : (
                    <Link to={item.to} className="flex w-full items-center gap-2">
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  )}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
NavigationDropdown.displayName = 'NavigationDropdown'

interface NavigationBrandProps {
  children: React.ReactNode
}

function NavigationBrand({ children }: NavigationBrandProps) {
  return (
    <div className="flex items-center gap-6">
      {children}
    </div>
  )
}
NavigationBrand.displayName = 'NavigationBrand'

interface NavigationDesktopProps {
  sections: NavigationSection[]
}

function NavigationDesktopSection({ section }: { section: NavigationSection }) {
  const visibleItems = section.items.filter(item => !item.hideOnDesktop)
  const sectionKey = visibleItems.map(item => item.to).join('-')

  if (visibleItems.length === 0) {
    return null
  }

  if (section.dropdown) {
    return <NavigationDropdown key={sectionKey} section={section} />
  }

  return (
    <nav key={sectionKey}>
      <ul className="flex gap-2 text-sm">
        {visibleItems.map(item => (
          <li key={item.to}>
            <NavigationItemComponent item={item} />
          </li>
        ))}
      </ul>
    </nav>
  )
}
NavigationDesktopSection.displayName = 'NavigationDesktopSection'

function NavigationDesktop({ sections }: NavigationDesktopProps) {
  const leftSections = sections.filter(s => s.position === 'left')
  const centerSections = sections.filter(s => s.position === 'center')
  const rightSections = sections.filter(s => !s.position || s.position === 'right')

  return (
    <div className="hidden lg:flex items-center flex-1">
      {leftSections.length > 0 && (
        <div className="flex items-center gap-4">
          {leftSections.map(section => (
            <NavigationDesktopSection key={section.items.map(i => i.to).join('-')} section={section} />
          ))}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center gap-4">
        {centerSections.map(section => (
          <NavigationDesktopSection key={section.items.map(i => i.to).join('-')} section={section} />
        ))}
      </div>

      {rightSections.length > 0 && (
        <div className="flex items-center gap-4">
          {rightSections.map(section => (
            <NavigationDesktopSection key={section.items.map(i => i.to).join('-')} section={section} />
          ))}
        </div>
      )}
    </div>
  )
}
NavigationDesktop.displayName = 'NavigationDesktop'

interface NavigationMobileProps {
  brand: React.ReactNode
  sections: NavigationSection[]
}

function NavigationMobile({ brand, sections }: NavigationMobileProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const closeMenu = () => setIsOpen(false)

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {brand}
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-6 space-y-1 pb-6">
          {sections.map((section, sectionIndex) => {
            const sectionKey = section.items.map(item => item.to).join('-')
            return (
              <React.Fragment key={sectionKey}>
                {section.separator && sectionIndex > 0 && (
                  <Separator className="my-2" />
                )}
                <NavigationSectionComponent
                  section={section}
                  isMobile
                  onItemClick={closeMenu}
                />
              </React.Fragment>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
NavigationMobile.displayName = 'NavigationMobile'

interface NavigationProps {
  brand: React.ReactNode
  sections?: NavigationSection[]
  className?: string
}

const defaultSections: NavigationSection[] = []

export function Navigation({ brand, sections = defaultSections, className }: NavigationProps) {
  return (
    <div className={cn('container mx-auto flex h-14 items-center justify-between gap-8 px-4', className)}>
      <NavigationBrand>{brand}</NavigationBrand>
      <NavigationDesktop sections={sections} />
      <NavigationMobile brand={brand} sections={sections} />
    </div>
  )
}
Navigation.displayName = 'Navigation'

export {
  NavigationBrand,
  NavigationDesktop,
  NavigationDesktopSection,
  NavigationDropdown,
  NavigationItemComponent as NavigationItem,
  NavigationMobile,
  NavigationSectionComponent as NavigationSection,
}
