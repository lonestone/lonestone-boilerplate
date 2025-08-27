import type { AuthResetPasswordFormData } from '../forms/auth-reset-password-form'
import { authClient } from '@/lib/auth-client'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { AuthPageHeader } from '../components/auth-page-header'
import { AuthResetPasswordForm } from '../forms/auth-reset-password-form'

export default function AuthResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: AuthResetPasswordFormData) => {
      const response = await authClient.resetPassword({
        newPassword: data.password,
        token: searchParams.get('token') || '',
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to reset password')
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
      <AuthPageHeader title="Reset Password" description="Enter your new password." />
      <AuthResetPasswordForm
        onSubmit={handleResetPassword}
        isPending={resetPasswordMutation.isPending}
      />
    </div>
  )
}
