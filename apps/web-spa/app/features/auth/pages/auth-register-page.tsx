import type { AuthRegisterFormData } from '../forms/auth-register-form'
import { toast } from '@boilerstone/ui/components/primitives/sonner'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { authClient } from '@/lib/auth-client'
import { AuthPageHeader } from '../components/auth-page-header'
import { AuthRegisterForm } from '../forms/auth-register-form'

export default function Register() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  const { mutate: register, isPending, isSuccess, error: errorRegister } = useMutation({
    mutationFn: async (data: AuthRegisterFormData) => {
      const response = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
        callbackURL: '/',
      })

      if (response.error) {
        throw new Error(response.error.code)
      }

      return response.data
    },
    onSuccess: (data) => {
      setSearchParams({ email: data.user.email })
      toast.success(t('auth.register.registrationSuccessful'))
    },
  })

  const handleRegister = (data: AuthRegisterFormData) => {
    register(data)
  }

  return isSuccess || searchParams.get('email')
    ? (
        <div>
          <AuthPageHeader title={t('auth.register.success.title')} description={t('auth.register.success.description')} />
          <div className="text-sm text-center mt-4">
            <Link to="/login" className="font-medium transition-colors">
              {t('auth.register.backToLogin')}
            </Link>
          </div>
        </div>
      )
    : (
        <div className="space-y-6">
          <AuthPageHeader title={t('auth.register.title')} description={t('auth.register.description')} />
          <AuthRegisterForm
            onSubmit={handleRegister}
            isPending={isPending}
          />
          <div className="h-10">
            {errorRegister ? <div className="text-sm font-medium text-red-500">{t('auth.register.failedToRegister')}</div> : null}
          </div>
          <div className="text-sm text-center">
            <Link to="/login" className="font-medium transition-colors">
              {t('auth.register.hasAccount')}
              {' '}
              {t('auth.register.login')}
            </Link>
          </div>
        </div>
      )
}
