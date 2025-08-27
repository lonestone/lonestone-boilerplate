import type { AuthForgotPasswordFormData } from '../forms/auth-forgot-password-form'
import { authClient } from '@/lib/auth-client'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { AuthPageHeader } from '../components/auth-page-header'
import { AuthForgotPasswordForm } from '../forms/auth-forgot-password-form'

export default function AuthForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false)
  const { mutate: forgotPasswordMutate, isPending, error } = useMutation({
    mutationFn: async (data: AuthForgotPasswordFormData) => {
      const response = await authClient.forgetPassword({
        email: data.email,
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send reset link')
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
      <AuthPageHeader title="Forgot Password" description="Enter your email to receive a link to reset your password." />
      {isSuccess
        ? (
            <>
              <div className="text-sm text-center">
                <Link to="/login" className="font-medium transition-colors">
                  Back to Login
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
                {error ? <div className="text-sm font-medium text-red-500">Failed to send reset link</div> : null}
              </div>
              <div className="text-sm text-center">
                <Link to="/login" className="font-medium transition-colors">
                  Back to Login
                </Link>
              </div>
            </>
          )}
    </div>
  )
}
