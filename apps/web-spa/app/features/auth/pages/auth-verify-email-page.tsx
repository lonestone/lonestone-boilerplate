import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { authClient } from '@/lib/auth-client'
import { AuthPageHeader } from '../components/auth-page-header'

export default function AuthVerifyEmailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    mutate: verifyEmailMutation,
    isPending,
    isSuccess,
  } = useMutation({
    mutationFn: async (token: string) => {
      const response = await authClient.verifyEmail({
        query: {
          token,
        },
      })

      if (response.error) {
        throw new Error(response.error.message || t('auth.verifyEmail.title'))
      }

      return response.data
    },
  })

  // React's StrictMode runs this effect twice on mount. Verifying the same
  // token twice is harmless by default, but with Better Auth's
  // `autoSignInAfterVerification` each call opens its own session.
  const verifiedTokenRef = useRef<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (token && verifiedTokenRef.current !== token) {
      verifiedTokenRef.current = token
      verifyEmailMutation(token)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (!isSuccess) {
      return
    }

    const timerId: ReturnType<typeof setTimeout> = setTimeout(() => {
      navigate('/login')
    }, 3000)

    return () => {
      clearTimeout(timerId)
    }
  }, [isSuccess, navigate])

  if (isPending) {
    return (
      <div>
        <AuthPageHeader
          title={t('auth.verifyEmail.verifying')}
          description={t('auth.verifyEmail.pleaseWait')}
        />
        <div className="flex h-full">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div>
        <AuthPageHeader
          title={t('auth.verifyEmail.verified')}
          description={t('auth.verifyEmail.redirecting')}
        />
        <div className="flex h-full">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
        <div className="text-sm text-center mt-4">
          <Link to="/login" className="font-medium transition-colors">
            {t('auth.verifyEmail.redirectNow')}
          </Link>
        </div>
      </div>
    )
  }

  return <Navigate to="/login" />
}
