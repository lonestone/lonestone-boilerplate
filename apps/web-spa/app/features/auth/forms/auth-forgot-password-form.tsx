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
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export type AuthForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

interface AuthForgotPasswordFormProps {
  onSubmit: (data: AuthForgotPasswordFormData) => void
  isPending: boolean
}

export const AuthForgotPasswordForm: React.FC<AuthForgotPasswordFormProps> = ({ onSubmit, isPending }) => {
  const { t } = useTranslation()
  const form = useForm<AuthForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="email">{t('auth.forgotPassword.email')}</FormLabel>
              <FormControl>
                <Input id="email" {...field} type="email" autoComplete="email" placeholder="your@email.com" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {t('auth.forgotPassword.sendResetLink')}
        </Button>
      </form>
    </Form>
  )
}
