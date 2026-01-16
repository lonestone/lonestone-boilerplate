import type { ForgotPasswordFormData } from '../schemas/forgot-password.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Text, View } from 'react-native'
import Toast from 'react-native-toast-message'
import { authClient } from '@/lib/auth-client'
import { Button, Input, SlideUpModal } from '@/src/components'
import { useTranslation } from '@/src/i18n'
import { forgotPasswordSchema } from '../schemas/forgot-password.schema'

interface ForgotPasswordModalProps {
  isVisible: boolean
  onClose: () => void
}

export function ForgotPasswordModal({ isVisible, onClose }: ForgotPasswordModalProps) {
  const { t } = useTranslation()

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  React.useEffect(() => {
    if (isVisible) {
      reset()
    }
  }, [isVisible, reset])

  const onSubmit = async (formData: ForgotPasswordFormData) => {
    try {
      const { error: authError } = await authClient.requestPasswordReset({
        email: formData.email,
      })

      if (authError) {
        Toast.show({
          type: 'error',
          text1: t('auth.login.forgotPasswordErrors.title'),
          text2: authError.message,
        })
        return
      }

      Toast.show({
        type: 'success',
        text1: t('auth.login.forgotPasswordSuccess.title'),
        text2: t('auth.login.forgotPasswordSuccess.subtitle'),
      })
      onClose()
    }
    catch (err) {
      Toast.show({
        type: 'error',
        text1: t('auth.login.errors.unexpectedError'),
      })
      console.error(err)
    }
  }

  return (
    <SlideUpModal visible={isVisible} onClose={onClose}>
      <View className="gap-6">
        <View className="gap-2">
          <Text className="text-xl font-semibold text-zinc-900 dark:text-white">
            {t('auth.login.forgotPasswordSheet.title')}
          </Text>
          <Text className="text-sm text-muted">
            {t('auth.login.forgotPasswordSheet.subtitle')}
          </Text>
        </View>

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

          <Button
            onPress={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
            className="w-full"
          >
            {t('auth.login.forgotPasswordSheet.submit')}
          </Button>

          <Button
            variant="ghost"
            className="w-full"
            onPress={onClose}
          >
            {t('common.cancel')}
          </Button>
        </View>
      </View>
    </SlideUpModal>
  )
}
