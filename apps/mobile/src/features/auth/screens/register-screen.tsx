import type { RegisterFormData } from '../schemas/auth.schema'
import type { RootNavigationProp } from '@/src/navigation/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigation } from '@react-navigation/native'
import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import Toast from 'react-native-toast-message'
import { authClient } from '@/lib/auth-client'
import { Button, Input, PasswordInput } from '@/src/components'
import { useTranslation } from '@/src/i18n'
import { useAuthStore } from '@/src/store'
import { registerSchema } from '../schemas/auth.schema'

export function RegisterScreen() {
  const navigation = useNavigation<RootNavigationProp>()
  const setUser = useAuthStore(state => state.setUser)
  const { t } = useTranslation()

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (formData: RegisterFormData) => {
    try {
      const { data, error: authError } = await authClient.signUp.email({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      })

      if (authError) {
        Toast.show({
          type: 'error',
          text1: t('auth.register.errors.registrationFailed'),
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
        text1: t('auth.register.errors.unexpectedError'),
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
              {t('auth.register.title')}
            </Text>
            <Text className="text-lg text-muted">
              {t('auth.register.subtitle')}
            </Text>
          </View>

          <View className="gap-6 rounded-3xl border border-border bg-card/90 p-6 shadow-lg shadow-black/5 dark:border-zinc-800 dark:bg-zinc-900/80">
            <View className="gap-4">
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('auth.register.name')}
                    placeholder={t('auth.register.namePlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    autoComplete="name"
                    error={errors.name?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('auth.register.email')}
                    placeholder={t('auth.register.emailPlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    error={errors.email?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <PasswordInput
                    label={t('auth.register.password')}
                    placeholder={t('auth.register.passwordPlaceholder')}
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
                    label={t('auth.register.confirmPassword')}
                    placeholder={t('auth.register.confirmPasswordPlaceholder')}
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
            >
              {t('auth.register.createAccount')}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onPress={() => navigation.navigate('Login')}
            >
              {t('auth.register.signIn')}
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
