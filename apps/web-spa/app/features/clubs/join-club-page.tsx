import { Button } from '@pitchkit/ui/components/primitives/button'
import { Input } from '@pitchkit/ui/components/primitives/input'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i

export function parseInvitationId(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    const fromPath = url.pathname.match(/\/invite\/([^/?#]+)/i)
    if (fromPath?.[1] && UUID_RE.test(fromPath[1])) return fromPath[1]
    const token = url.searchParams.get('invitationId') ?? url.searchParams.get('token')
    if (token && UUID_RE.test(token)) return token
  } catch {
    // not a URL — try raw UUID or path fragment
  }

  const pathMatch = trimmed.match(/\/invite\/([^/?#]+)/i)
  if (pathMatch?.[1] && UUID_RE.test(pathMatch[1])) return pathMatch[1]

  const uuidMatch = trimmed.match(UUID_RE)
  return uuidMatch?.[0] ?? null
}

export default function JoinClubPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const invitationId = parseInvitationId(value)
    if (!invitationId) {
      setError(t('join.invalidInvite'))
      return
    }
    setError(null)
    navigate(`/invite/${invitationId}`)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('join.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('join.description')}</p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="invite" className="text-sm font-medium">
            {t('join.inviteLabel')}
          </label>
          <Input
            id="invite"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (error) setError(null)
            }}
            placeholder={t('join.invitePlaceholder')}
            autoComplete="off"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <Button type="submit" className="w-full">
          {t('join.continue')}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t('join.createInstead')}{' '}
        <Link to="/register?intent=create" className="font-medium text-foreground underline">
          {t('join.createClub')}
        </Link>
      </p>
      <p className="text-center text-sm">
        <Link to="/login" className="font-medium transition-colors">
          {t('join.signIn')}
        </Link>
      </p>
    </div>
  )
}
