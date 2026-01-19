import type { AuthResetPasswordFormData } from '../forms/auth-reset-password-form'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { authClient } from '@/lib/auth-client'
import { AuthPageHeader } from '../components/auth-page-header'
import { AuthResetPasswordForm } from '../forms/auth-reset-password-form'

export default function AuthResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: AuthResetPasswordFormData) => {
      const response = await authClient.resetPassword({
        newPassword: data.password,
        token: searchParams.get('token') || '',
      })

      if (response.error) {
        throw new Error(response.error.message || t('auth.resetPassword.reset'))
      }

      return response.data
    },
    onSuccess: () => {
      navigate('/login')
    },
  })

  const handleResetPassword = (data: AuthResetPasswordFormData) => {
    resetPasswordMutation.mutate(data)
  }

  return (
    <div className="space-y-6">
      <AuthPageHeader title={t('auth.resetPassword.title')} description={t('auth.resetPassword.description')} />
      <AuthResetPasswordForm
        onSubmit={handleResetPassword}
        isPending={resetPasswordMutation.isPending}
      />
    </div>
  )
}
