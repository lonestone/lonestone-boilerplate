import { SearchIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useRef } from 'react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@boilerstone/ui/components/primitives/input-group'

interface SearchConfig {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

interface DataTableToolbarProps {
  search?: SearchConfig
  children?: ReactNode
}

function useDebounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(
    ((...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => fn(...args), delay)
    }) as T,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, delay],
  )
}

export function DataTableToolbar({ search, children }: DataTableToolbarProps) {
  const onSearchDebounced = useDebounce((value: string) => {
    search?.onChange(value)
  }, 300)

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 items-center space-x-2">
        {search ? (
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={search.placeholder ?? 'Search...'}
              defaultValue={search.value}
              onChange={(event) => onSearchDebounced(event.currentTarget.value)}
              className="w-[150px] lg:w-[250px]"
            />
          </InputGroup>
        ) : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  )
}
