import { z } from 'zod'
import i18n from '@/src/i18n/config'

export const forgotPasswordSchema = z.object({
  email: z.string().email(i18n.t('auth.login.errors.invalidEmail')),
})

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
