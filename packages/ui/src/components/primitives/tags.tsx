import type { ComponentProps, MouseEventHandler, ReactNode } from 'react'
import { XIcon } from 'lucide-react'
import { createContext, use, useEffect, useRef, useState } from 'react'
import { Badge } from './badge'
import { Button } from './button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { cn } from '@boilerstone/ui/lib/utils'

interface TagsContextType {
  value?: string
  setValue?: (value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  width?: number
  setWidth?: (width: number) => void
}

const TagsContext = createContext<TagsContextType>({
  value: undefined,
  setValue: undefined,
  open: false,
  onOpenChange: () => {},
  width: undefined,
  setWidth: undefined,
})

function useTagsContext() {
  const context = use(TagsContext)
  if (!context) {
    throw new Error('useTagsContext must be used within a Tags component')
  }
  return context
}

interface TagsProps {
  value?: string
  setValue?: (value: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
  className?: string
}

function Tags({
  value,
  setValue,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  children,
  className,
}: TagsProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [width, setWidth] = useState<number | undefined>(undefined)
  const ref = useRef<HTMLDivElement>(null)

  const open = controlledOpen ?? uncontrolledOpen
  const onOpenChange = controlledOnOpenChange ?? setUncontrolledOpen

  useEffect(() => {
    if (!ref.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width)
    })
    resizeObserver.observe(ref.current)

    return () => resizeObserver.disconnect()
  }, [])

  return (
    <TagsContext value={{ value, setValue, open, onOpenChange, width, setWidth }}>
      <Popover onOpenChange={onOpenChange} open={open}>
        <div className={cn('relative w-full', className)} ref={ref}>
          {children}
        </div>
      </Popover>
    </TagsContext>
  )
}

type TagsTriggerProps = ComponentProps<typeof Button>

function TagsTrigger({ className, children, ...props }: TagsTriggerProps) {
  return (
    <PopoverTrigger
      render={
        <Button
          className={cn('h-auto w-full justify-between p-2', className)}
          // eslint-disable-next-line jsx-a11y/no-interactive-element-to-noninteractive-role
          role="combobox"
          variant="outline"
          {...props}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-1">
        {children}
        <span className="px-2 py-px text-muted-foreground">Select a tag...</span>
      </div>
    </PopoverTrigger>
  )
}

type TagsValueProps = ComponentProps<typeof Badge> & { onRemove?: () => void }

function TagsValue({ className, children, onRemove, ...props }: TagsValueProps) {
  const handleRemove: MouseEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault()
    event.stopPropagation()
    onRemove?.()
  }

  return (
    <Badge className={cn('flex items-center gap-2', className)} {...props}>
      {children}
      {onRemove && (
        // biome-ignore lint/a11y/noStaticElementInteractions: clickable badge remove button
        // biome-ignore lint/a11y/useKeyWithClickEvents: clickable badge remove button
        <div
          className="size-auto cursor-pointer hover:text-muted-foreground"
          onClick={handleRemove}
        >
          <XIcon size={12} />
        </div>
      )}
    </Badge>
  )
}

type TagsContentProps = ComponentProps<typeof PopoverContent>

function TagsContent({ className, children, ...props }: TagsContentProps) {
  const { width } = useTagsContext()

  return (
    <PopoverContent className={cn('p-0', className)} style={{ width }} {...props}>
      <Command>{children}</Command>
    </PopoverContent>
  )
}

type TagsInputProps = ComponentProps<typeof CommandInput>

function TagsInput({ className, ...props }: TagsInputProps) {
  return <CommandInput className={cn('h-9', className)} {...props} />
}

type TagsListProps = ComponentProps<typeof CommandList>

function TagsList({ className, ...props }: TagsListProps) {
  return <CommandList className={cn('max-h-[200px]', className)} {...props} />
}

type TagsEmptyProps = ComponentProps<typeof CommandEmpty>

function TagsEmpty({ children, ...props }: TagsEmptyProps) {
  return <CommandEmpty {...props}>{children ?? 'No tags found.'}</CommandEmpty>
}

const TagsGroup = CommandGroup

type TagsItemProps = ComponentProps<typeof CommandItem>

function TagsItem({ className, ...props }: TagsItemProps) {
  return (
    <CommandItem
      className={cn('cursor-pointer items-center justify-between', className)}
      {...props}
    />
  )
}

export {
  Tags,
  TagsContent,
  TagsEmpty,
  TagsGroup,
  TagsInput,
  TagsItem,
  TagsList,
  TagsTrigger,
  TagsValue,
  type TagsProps,
  type TagsTriggerProps,
  type TagsValueProps,
  type TagsContentProps,
  type TagsInputProps,
  type TagsListProps,
  type TagsEmptyProps,
  type TagsItemProps,
}
