import { Badge } from '@pitchkit/ui/components/primitives/badge'
import { Input } from '@pitchkit/ui/components/primitives/input'
import { XIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface EmailPillsInputProps {
  emails: string[]
  onChange: (emails: string[]) => void
  placeholder?: string
}

export function EmailPillsInput({ emails, onChange, placeholder }: EmailPillsInputProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addEmail = (raw: string) => {
    const email = raw.trim().replace(/,$/, '').toLowerCase()
    if (!email) return
    if (!EMAIL_RE.test(email)) {
      setError(t('onboarding.step4.invalidEmail'))
      return
    }
    if (emails.includes(email)) {
      setDraft('')
      setError(null)
      return
    }
    onChange([...emails, email])
    setDraft('')
    setError(null)
  }

  const removeEmail = (email: string) => {
    onChange(emails.filter((e) => e !== email))
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
        {emails.map((email) => (
          <Badge key={email} variant="secondary" className="gap-1 pr-1">
            {email}
            <button
              type="button"
              className="rounded-sm p-0.5 hover:bg-muted"
              onClick={() => removeEmail(email)}
              aria-label={t('onboarding.step4.removeEmail', { email })}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={draft}
          onChange={(e) => {
            const next = e.target.value
            if (next.includes(',')) {
              const parts = next.split(',')
              const last = parts.pop() ?? ''
              for (const part of parts) addEmail(part)
              setDraft(last)
              return
            }
            setDraft(next)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addEmail(draft)
            } else if (e.key === 'Backspace' && !draft && emails.length > 0) {
              onChange(emails.slice(0, -1))
            }
          }}
          onBlur={() => {
            if (draft.trim()) addEmail(draft)
          }}
          placeholder={emails.length === 0 ? placeholder : undefined}
          className="h-7 min-w-[140px] flex-1 border-0 shadow-none focus-visible:ring-0"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
