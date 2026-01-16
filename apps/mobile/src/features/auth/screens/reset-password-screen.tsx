import type { RouteProp } from '@react-navigation/native'
import type { ResetPasswordFormData } from '../schemas/reset-password.schema'
import type { AuthStackParamList, RootNavigationProp } from '@/src/navigation/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigation, useRoute } from '@react-navigation/native'
import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import Toast from 'react-native-toast-message'
import { authClient } from '@/lib/auth-client'
import { Button, PasswordInput } from '@/src/components'
import { useTranslation } from '@/src/i18n'
import { useAuthStore } from '@/src/store'
import { resetPasswordSchema } from '../schemas/reset-password.schema'

type ResetPasswordRouteProp = RouteProp<AuthStackParamList, 'ResetPassword'>

export function ResetPasswordScreen() {
  const navigation = useNavigation<RootNavigationProp>()
  const route = useRoute<ResetPasswordRouteProp>()
  const token = route.params?.token
  const hasToken = Boolean(token)
  const { t } = useTranslation()
  const logout = useAuthStore(state => state.logout)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (formData: ResetPasswordFormData) => {
    if (!hasToken) {
      Toast.show({
        type: 'error',
        text1: t('auth.resetPassword.errors.missingTokenTitle'),
        text2: t('auth.resetPassword.errors.missingTokenSubtitle'),
      })
      return
    }

    try {
      const { error } = await authClient.resetPassword({
        token,
        newPassword: formData.password,
      })

      if (error) {
        Toast.show({
          type: 'error',
          text1: t('auth.resetPassword.errors.resetFailed'),
          text2: error.message,
        })
        return
      }

      Toast.show({
        type: 'success',
        text1: t('auth.resetPassword.success.title'),
        text2: t('auth.resetPassword.success.subtitle'),
      })
      logout()
      navigation.navigate('Login')
    }
    catch (err) {
      Toast.show({
        type: 'error',
        text1: t('auth.resetPassword.errors.unexpectedError'),
      })
      console.error(err)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#f8f7f4] dark:bg-black"
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-6 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center gap-8">
          <View className="gap-2">
            <Text className="text-4xl font-semibold text-zinc-900 dark:text-white">
              {t('auth.resetPassword.title')}
            </Text>
            <View className="gap-1">
              <Text className="text-lg text-muted">
                {t('auth.resetPassword.subtitle')}
              </Text>
              {!hasToken
                ? (
                    <Text className="text-sm text-muted">
                      {t('auth.resetPassword.missingTokenHelp')}
                    </Text>
                  )
                : null}
            </View>
          </View>

          <View className="gap-6 rounded-3xl border border-border bg-card/90 p-6 shadow-lg shadow-black/5 dark:border-zinc-800 dark:bg-zinc-900/80">
            <View className="gap-4">
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <PasswordInput
                    label={t('auth.resetPassword.password')}
                    placeholder={t('auth.resetPassword.passwordPlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoComplete="password-new"
                    error={errors.password?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <PasswordInput
                    label={t('auth.resetPassword.confirmPassword')}
                    placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoComplete="password-new"
                    error={errors.confirmPassword?.message}
                  />
                )}
              />
            </View>

            <Button
              onPress={handleSubmit(onSubmit)}
              isLoading={isSubmitting}
              className="w-full"
              disabled={!hasToken}
            >
              {t('auth.resetPassword.submit')}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onPress={() => navigation.navigate('Login')}
            >
              {t('auth.resetPassword.backToLogin')}
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
