import { useState } from 'react'

interface UseDisclosureReturn {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  setOpen: (value: boolean) => void
}

export function useDisclosure(initialState = false): UseDisclosureReturn {
  const [isOpen, setOpen] = useState(initialState)

  const open = () => setOpen(true)
  const close = () => setOpen(false)
  const toggle = () => setOpen((prev) => !prev)

  return { isOpen, open, close, toggle, setOpen }
}
