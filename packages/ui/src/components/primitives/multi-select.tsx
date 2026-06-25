import type { ReactNode } from 'react'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useState } from 'react'
import { Badge } from './badge'
import { Button } from './button'
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from './command'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { cn } from '@boilerstone/ui/lib/utils'

interface MultiSelectOption {
  label: string
  value: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  maxDisplayedBadges?: number
  renderOptionContent?: (option: MultiSelectOption) => ReactNode
  className?: string
}

export function MultiSelect({
  options,
  values,
  onChange,
  placeholder,
  maxDisplayedBadges = 2,
  renderOptionContent,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [selectedValues, setSelectedValues] = useState<string[]>(values)

  const handleToggleValue = (value: string) => {
    const next = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value]
    setSelectedValues(next)
    onChange(next)
  }

  const renderTriggerContent = () => {
    if (selectedValues.length === 0) {
      return (
        <span className="text-muted-foreground">
          {placeholder ?? 'Select items...'}
        </span>
      )
    }

    const badges = selectedValues
      .slice(0, maxDisplayedBadges)
      .map((v) => options.find((o) => o.value === v)?.label)
      .map((label) => (
        <Badge key={label} variant="outline">
          {label}
        </Badge>
      ))

    if (selectedValues.length > maxDisplayedBadges) {
      return (
        <div className="flex gap-1.5 flex-wrap">
          {badges}
          <Badge variant="outline">+{selectedValues.length - maxDisplayedBadges}</Badge>
        </div>
      )
    }

    return <div className="flex gap-1.5 flex-wrap">{badges}</div>
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
        >
          {renderTriggerContent()}
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={false}>
          <CommandList>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleToggleValue(option.value)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <CheckIcon
                        className={cn(
                          'size-4',
                          isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      {renderOptionContent ? renderOptionContent(option) : option.label}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
