import type { LoginFormData } from '../schemas/auth.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { Button, Input, PasswordInput } from '@/src/components'
import { useTranslation } from '@/src/i18n'
import { loginSchema } from '../schemas/auth.schema'

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => void
  onRegister: () => void
  onForgotPassword: () => void
}

export function LoginForm({ onSubmit, onRegister, onForgotPassword }: LoginFormProps) {
  const { t } = useTranslation()

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

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
              {t('auth.login.title')}
            </Text>
            <Text className="text-lg text-muted">
              {t('auth.login.subtitle')}
            </Text>
          </View>

          <View className="gap-6 rounded-3xl border border-border bg-card/90 p-6 shadow-lg shadow-black/5 dark:border-zinc-800 dark:bg-zinc-900/80">
            <View className="gap-4">
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('auth.login.email')}
                    placeholder={t('auth.login.emailPlaceholder')}
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
                    label={t('auth.login.password')}
                    placeholder={t('auth.login.passwordPlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoComplete="password"
                    error={errors.password?.message}
                  />
                )}
              />
            </View>

            <Button
              variant="link"
              onPress={onForgotPassword}
              className="self-start px-0"
            >
              {t('auth.login.forgotPassword')}
            </Button>

            <Button
              onPress={handleSubmit(onSubmit)}
              isLoading={isSubmitting}
              className="w-full"
            >
              {t('auth.login.signIn')}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onPress={onRegister}
            >
              {t('auth.login.createAccount')}
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
