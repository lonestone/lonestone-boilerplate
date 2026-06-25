import { CalendarIcon } from 'lucide-react'
import * as React from 'react'
import { cn } from '@boilerstone/ui/lib/utils'
import { Calendar } from './calendar'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from './input-group'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function parseDate(input: string): Date | undefined {
  const parsed = new Date(input)
  if (!Number.isNaN(parsed.getTime())) return parsed

  // Try MM/DD/YYYY
  const parts = input.split('/')
  if (parts.length === 3) {
    const [month, day, year] = parts
    const d = new Date(`${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`)
    if (!Number.isNaN(d.getTime())) return d
  }

  return undefined
}

interface DatePickerProps {
  initialDate?: Date
  onDateChange?: (date: Date | undefined) => void
  className?: string
  placeholder?: string
  disabled?: boolean
}

export function DatePicker({
  initialDate,
  onDateChange,
  className,
  placeholder,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date | undefined>(initialDate)
  const [month, setMonth] = React.useState<Date | undefined>(initialDate)
  const [inputValue, setInputValue] = React.useState(
    initialDate ? formatDate(initialDate) : '',
  )

  const handleDateChange = (next: Date | undefined) => {
    setDate(next)
    setInputValue(next ? formatDate(next) : '')
    onDateChange?.(next)
  }

  const handleInputBlur = () => {
    if (date) {
      setInputValue(formatDate(date))
    }
    else {
      setInputValue('')
    }
  }

  return (
    <InputGroup className={cn('w-full h-full min-h-10', className)}>
      <InputGroupInput
        value={inputValue}
        placeholder={placeholder ?? 'Pick a date'}
        disabled={disabled}
        onChange={(e) => {
          const parsed = parseDate(e.target.value)
          setInputValue(e.target.value)
          if (parsed) {
            setDate(parsed)
            setMonth(parsed)
          }
        }}
        onBlur={handleInputBlur}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
          }
          else if (e.key === 'Enter') {
            e.preventDefault()
            handleDateChange(date)
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <InputGroupButton
              variant="ghost"
              size="icon-xs"
              aria-label="Open date picker"
              disabled={disabled}
            >
              <CalendarIcon />
              <span className="sr-only">Select date</span>
            </InputGroupButton>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto overflow-hidden p-0"
            align="end"
            sideOffset={8}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <Calendar
              mode="single"
              selected={date}
              month={month}
              onMonthChange={setMonth}
              captionLayout="dropdown"
              onSelect={(selected) => {
                handleDateChange(selected)
                setOpen(false)
              }}
              className="w-full"
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  )
}
