import type { AuthLoginFormData } from '../forms/auth-login-form'
import { toast } from '@boilerstone/ui/components/primitives/sonner'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { authClient } from '@/lib/auth-client'
import { AuthPageHeader } from '../components/auth-page-header'
import { AuthLoginForm } from '../forms/auth-login-form'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { mutate: loginMutate, isPending: isLoginPending, error } = useMutation({
    mutationFn: async (data: AuthLoginFormData) => {
      const response = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        callbackURL: '/',
        rememberMe: true,
      })

      if (response.error) {
        throw new Error(response.error.code)
      }

      toast.success(t('auth.login.loggedInSuccess'))
      return response.data
    },
    onSuccess: (data) => {
      navigate(data.url || '/')
    },
  })

  const handleLogin = (data: AuthLoginFormData) => {
    loginMutate(data)
  }

  return (
    <div className="space-y-6">
      <AuthPageHeader title={t('auth.login.title')} description={t('auth.login.description')} />
      <AuthLoginForm
        onSubmit={handleLogin}
        isPending={isLoginPending}
      />
      <div className="h-10">
        {error ? <div className="text-sm font-medium text-red-500">{error.message === 'BANNED_USER' ? t('auth.login.bannedUser') : t('auth.login.badCredentials')}</div> : null}
      </div>
      <div className="text-sm text-center">
        <Link to="/register" className="font-medium transition-colors">
          {t('auth.login.noAccount')}
          {' '}
          {t('auth.login.signUp')}
        </Link>
      </div>
    </div>
  )
}
