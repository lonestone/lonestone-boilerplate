import type { AuthRegisterFormData } from '../forms/auth-register-form'
import { toast } from '@lonestone/ui/components/primitives/sonner'
import { useMutation } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { authClient } from '@/lib/auth-client'
import { AuthPageHeader } from '../components/auth-page-header'
import { AuthRegisterForm } from '../forms/auth-register-form'

export default function Register() {
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
      toast.success('Registration successful')
    },
  })

  const handleRegister = (data: AuthRegisterFormData) => {
    register(data)
  }

  return isSuccess || searchParams.get('email')
    ? (
        <div>
          <AuthPageHeader title="Registration successful" description="Check your email for the activation link." />
          <div className="text-sm text-center mt-4">
            <Link to="/login" className="font-medium transition-colors">
              Back to Login
            </Link>
          </div>
        </div>
      )
    : (
        <div className="space-y-6">
          <AuthPageHeader title="Registration" description="Create an account to get started." />
          <AuthRegisterForm
            onSubmit={handleRegister}
            isPending={isPending}
          />
          <div className="h-10">
            {errorRegister ? <div className="text-sm font-medium text-red-500">Failed to register</div> : null}
          </div>
          <div className="text-sm text-center">
            <Link to="/login" className="font-medium transition-colors">
              Already have an account? Login
            </Link>
          </div>
        </div>
      )
}
