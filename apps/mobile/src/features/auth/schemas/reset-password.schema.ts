import { z } from 'zod'
import i18n from '@/src/i18n/config'

export const resetPasswordSchema = z.object({
  password: z.string().min(6, i18n.t('auth.resetPassword.errors.passwordMinLength')),
  confirmPassword: z.string().min(1, i18n.t('auth.resetPassword.errors.confirmPasswordRequired')),
}).refine(data => data.password === data.confirmPassword, {
  message: i18n.t('auth.resetPassword.errors.passwordMismatch'),
  path: ['confirmPassword'],
})

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
