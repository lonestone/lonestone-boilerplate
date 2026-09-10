import type { AuthRegisterFormData } from '../forms/auth-register-form'
import { toast } from '@pitchkit/ui/components/primitives/sonner'
import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { storePendingInvitationId } from '@/features/auth/utils/pending-invitation'
import { authClient } from '@/lib/auth-client'
import { AuthPageHeader } from '../components/auth-page-header'
import { AuthRegisterForm } from '../forms/auth-register-form'

export default function Register() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const inviteEmail = searchParams.get('email') ?? undefined
  const invitationId = searchParams.get('invitationId') ?? searchParams.get('invite')
  const clubName = searchParams.get('club')
  const intent = searchParams.get('intent')

  useEffect(() => {
    if (invitationId) storePendingInvitationId(invitationId)
  }, [invitationId])

  const {
    mutate: register,
    isPending,
    isSuccess,
    error: errorRegister,
  } = useMutation({
    mutationFn: async (data: AuthRegisterFormData) => {
      const name = `${data.firstName} ${data.lastName}`.trim()
      const response = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name,
        // @ts-expect-error additional fields inferred at runtime
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        callbackURL: '/',
      })

      if (response.error) {
        throw new Error(response.error.code)
      }

      return response.data
    },
    onSuccess: (data) => {
      const nextParams: Record<string, string> = { email: data.user.email }
      if (invitationId) nextParams.invitationId = invitationId
      if (clubName) nextParams.club = clubName
      setSearchParams(nextParams)
      toast.success(t('auth.register.registrationSuccessful'))
    },
  })

  const description = clubName
    ? t('auth.register.joinClub', { club: clubName })
    : intent === 'create'
      ? t('auth.register.createClubDescription')
      : t('auth.register.description')

  const loginTo = invitationId
    ? `/login?invitationId=${encodeURIComponent(invitationId)}${clubName ? `&club=${encodeURIComponent(clubName)}` : ''}`
    : '/login'

  if (isSuccess) {
    return (
      <div>
        <AuthPageHeader
          title={t('auth.register.success.title')}
          description={t('auth.register.success.description')}
        />
        <div className="text-sm text-center mt-4">
          <Link to={loginTo} className="font-medium transition-colors">
            {t('auth.register.backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AuthPageHeader
        title={
          intent === 'create' ? t('auth.register.createClubTitle') : t('auth.register.title')
        }
        description={description}
      />
      <AuthRegisterForm
        onSubmit={(data) => register(data)}
        isPending={isPending}
        defaultEmail={inviteEmail}
      />
      <div className="h-10">
        {errorRegister ? (
          <div className="text-sm font-medium text-red-500">
            {t('auth.register.failedToRegister')}
          </div>
        ) : null}
      </div>
      <div className="text-sm text-center">
        <Link to={loginTo} className="font-medium transition-colors">
          {t('auth.register.hasAccount')} {t('auth.register.login')}
        </Link>
      </div>
    </div>
  )
}
