import type { LoginFormData } from '../schemas/auth.schema'
import type { RootNavigationProp } from '@/src/navigation/types'
import { useNavigation } from '@react-navigation/native'
import * as React from 'react'
import Toast from 'react-native-toast-message'
import { authClient } from '@/lib/auth-client'
import { useTranslation } from '@/src/i18n'
import { useAuthStore } from '@/src/store'
import { ForgotPasswordModal } from '../components/forgot-password-modal'
import { LoginForm } from '../components/login-form'

export function LoginScreen() {
  const navigation = useNavigation<RootNavigationProp>()
  const setUser = useAuthStore(state => state.setUser)
  const { t } = useTranslation()
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = React.useState(false)

  const onSubmit = async (formData: LoginFormData) => {
    try {
      const { data, error: authError } = await authClient.signIn.email({
        email: formData.email,
        password: formData.password,
      })

      if (authError) {
        Toast.show({
          type: 'error',
          text1: t('auth.login.errors.loginFailed'),
          text2: authError.message,
        })
        return
      }

      if (data?.user) {
        setUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
        })
      }
    }
    catch (err) {
      Toast.show({
        type: 'error',
        text1: t('auth.login.errors.unexpectedError'),
      })
      console.error(err)
    }
  }

  const handleOpenForgotPassword = () => {
    setIsForgotPasswordOpen(true)
  }

  const handleCloseForgotPassword = () => {
    setIsForgotPasswordOpen(false)
  }

  return (
    <>
      <LoginForm
        onSubmit={onSubmit}
        onForgotPassword={handleOpenForgotPassword}
        onRegister={() => navigation.navigate('Register')}
      />

      <ForgotPasswordModal
        isVisible={isForgotPasswordOpen}
        onClose={handleCloseForgotPassword}
      />
    </>
  )
}
