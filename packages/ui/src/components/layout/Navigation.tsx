import { Button } from '@boilerstone/ui/components/primitives/button'
import { Separator } from '@boilerstone/ui/components/primitives/separator'
import { Sheet, SheetContent, SheetTrigger } from '@boilerstone/ui/components/primitives/sheet'
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
}

export interface NavigationSection {
  items: NavigationItem[]
  separator?: boolean
}

interface NavigationItemProps {
  item: NavigationItem
  isMobile?: boolean
  onItemClick?: () => void
}

function NavigationItemComponent({ item, isMobile = false, onItemClick }: NavigationItemProps) {
  const baseClassName = cn(
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
  const sectionKey = section.items.map(item => item.to).join('-')

  return (
    <div key={sectionKey} className="flex flex-col gap-2">
      {section.items.map(item => (
        <NavigationItemComponent
          key={item.to}
          item={item}
          isMobile={isMobile}
          onItemClick={onItemClick}
        />
      ))}
    </div>
  )
}
NavigationSectionComponent.displayName = 'NavigationSection'

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
  desktopActions?: React.ReactNode
}

function NavigationDesktop({ sections, desktopActions }: NavigationDesktopProps) {
  const mainSection = sections[0]

  return (
    <>
      <div className="hidden md:flex items-center gap-6 flex-1">
        {mainSection && mainSection.items.length > 0 && (
          <nav>
            <ul className="flex gap-2 text-sm">
              {mainSection.items.map(item => (
                <li key={item.to}>
                  <NavigationItemComponent item={item} />
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      {desktopActions && (
        <div className="hidden md:flex items-center gap-2">
          {desktopActions}
        </div>
      )}
    </>
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
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <div className="flex flex-col gap-6 mt-8">
          <div className="flex items-center">
            {brand}
          </div>
          {sections.length > 0 && (
            <div className="flex flex-col gap-4">
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
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
NavigationMobile.displayName = 'NavigationMobile'

interface NavigationProps {
  brand: React.ReactNode
  sections?: NavigationSection[]
  desktopActions?: React.ReactNode
  className?: string
}

const defaultSections: NavigationSection[] = []

export function Navigation({ brand, sections = defaultSections, desktopActions, className }: NavigationProps) {
  return (
    <div className={cn('container mx-auto flex h-14 items-center justify-between gap-8 px-4', className)}>
      <NavigationBrand>{brand}</NavigationBrand>
      <NavigationDesktop sections={sections} desktopActions={desktopActions} />
      <NavigationMobile brand={brand} sections={sections} />
    </div>
  )
}
Navigation.displayName = 'Navigation'

export {
  NavigationBrand,
  NavigationDesktop,
  NavigationItemComponent as NavigationItem,
  NavigationMobile,
  NavigationSectionComponent as NavigationSection,
}
