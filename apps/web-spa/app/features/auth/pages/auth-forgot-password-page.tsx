import type { AuthForgotPasswordFormData } from '../forms/auth-forgot-password-form'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { authClient } from '@/lib/auth-client'
import { AuthPageHeader } from '../components/auth-page-header'
import { AuthForgotPasswordForm } from '../forms/auth-forgot-password-form'

export default function AuthForgotPasswordPage() {
  const { t } = useTranslation()
  const [isSuccess, setIsSuccess] = useState(false)
  const { mutate: forgotPasswordMutate, isPending, error } = useMutation({
    mutationFn: async (data: AuthForgotPasswordFormData) => {
      const response = await authClient.requestPasswordReset({
        email: data.email,
      })

      if (response.error) {
        throw new Error(response.error.message || t('auth.forgotPassword.failedToSend'))
      }

      return response.data
    },
    onSuccess: () => {
      setIsSuccess(true)
    },
  })

  const handleForgotPassword = (data: AuthForgotPasswordFormData) => {
    forgotPasswordMutate(data)
  }

  return (
    <div className="space-y-6">
      <AuthPageHeader title={t('auth.forgotPassword.title')} description={t('auth.forgotPassword.description')} />
      {isSuccess
        ? (
            <>
              <div className="text-sm text-center">
                <Link to="/login" className="font-medium transition-colors">
                  {t('auth.forgotPassword.backToLogin')}
                </Link>
              </div>
            </>
          )
        : (
            <>
              <AuthForgotPasswordForm
                onSubmit={handleForgotPassword}
                isPending={isPending}
              />
              <div className="h-10">
                {error ? <div className="text-sm font-medium text-red-500">{t('auth.forgotPassword.failedToSend')}</div> : null}
              </div>
              <div className="text-sm text-center">
                <Link to="/login" className="font-medium transition-colors">
                  {t('auth.forgotPassword.backToLogin')}
                </Link>
              </div>
            </>
          )}
    </div>
  )
}
