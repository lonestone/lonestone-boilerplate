import { authClient } from '@/lib/auth-client'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { AuthPageHeader } from '../components/auth-page-header'

export default function AuthVerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { mutate: verifyEmailMutation, isPending, isSuccess } = useMutation({
    mutationFn: async (token: string) => {
      const response = await authClient.verifyEmail({
        query: {
          token,
        },
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to verify email')
      }

      return response.data
    },
    onSuccess: () => {
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    },
  })

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      verifyEmailMutation(token)
    }
  }, [searchParams])

  if (isPending) {
    return (
      <div>
        <AuthPageHeader title="Verifying email" description="Please wait..." />
        <div className="flex h-full">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div>
        <AuthPageHeader title="Email verified" description="Redirecting to login..." />
        <div className="flex h-full">
          <Loader2 className="w-10 h-10 animate-spin" />
        </div>
        <div className="text-sm text-center mt-4">
          <Link to="/login" className="font-medium transition-colors">
            Redirect now
          </Link>
        </div>
      </div>
    )
  }

  return <Navigate to="/login" />
}
