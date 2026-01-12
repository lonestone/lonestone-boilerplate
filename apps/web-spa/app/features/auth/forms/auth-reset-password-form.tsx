import { Button } from '@boilerstone/ui/components/primitives/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@boilerstone/ui/components/primitives/form'
import { Input } from '@boilerstone/ui/components/primitives/input'
import { zodResolver } from '@hookform/resolvers/zod'
import React from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

const baseResetPasswordSchema = z.object({
  password: z.string().min(6),
  confirmPassword: z.string(),
})

function getResetPasswordSchema(t: (key: string) => string) {
  return baseResetPasswordSchema.refine(data => data.password === data.confirmPassword, {
    message: t('errorCodes.PASSWORDS_DO_NOT_MATCH'),
    path: ['confirmPassword'],
  })
}

export type AuthResetPasswordFormData = z.infer<typeof baseResetPasswordSchema>

interface AuthResetPasswordFormProps {
  onSubmit: (data: AuthResetPasswordFormData) => void
  isPending: boolean
}

export const AuthResetPasswordForm: React.FC<AuthResetPasswordFormProps> = ({ onSubmit, isPending }) => {
  const { t } = useTranslation()
  const resetPasswordSchema = getResetPasswordSchema(t)
  const form = useForm<AuthResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormMessage />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="password">{t('auth.resetPassword.password')}</FormLabel>
              <FormControl>
                <Input id="password" {...field} type="password" autoComplete="new-password" placeholder="••••••••" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="confirmPassword">{t('auth.resetPassword.confirmPassword')}</FormLabel>
              <FormControl>
                <Input id="confirmPassword" {...field} type="password" autoComplete="new-password" placeholder="••••••••" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {t('auth.resetPassword.reset')}
        </Button>
      </form>
    </Form>
  )
}
