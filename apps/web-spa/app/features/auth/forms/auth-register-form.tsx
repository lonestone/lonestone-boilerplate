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

const baseRegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  confirmPassword: z.string(),
})

function getRegisterSchema(t: (key: string) => string) {
  return baseRegisterSchema.refine(data => data.password === data.confirmPassword, {
    message: t('errorCodes.PASSWORDS_DO_NOT_MATCH'),
    path: ['confirmPassword'],
  })
}

export type AuthRegisterFormData = z.infer<typeof baseRegisterSchema>

interface AuthRegisterFormProps {
  onSubmit: (data: AuthRegisterFormData) => void
  isPending: boolean
}

export const AuthRegisterForm: React.FC<AuthRegisterFormProps> = ({ onSubmit, isPending }) => {
  const { t } = useTranslation()
  const registerSchema = getRegisterSchema(t)
  const form = useForm<AuthRegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  return (
    <Form {...form}>
      <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <FormMessage />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="name">{t('auth.register.name')}</FormLabel>
              <FormControl>
                <Input id="name" {...field} type="text" autoComplete="name" placeholder="John" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="email">{t('auth.register.email')}</FormLabel>
              <FormControl>
                <Input id="email" {...field} type="email" autoComplete="email" placeholder="your@email.com" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="password">{t('auth.register.password')}</FormLabel>
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
              <FormLabel htmlFor="confirmPassword">{t('auth.register.confirmPassword')}</FormLabel>
              <FormControl>
                <Input id="confirmPassword" {...field} type="password" autoComplete="new-password" placeholder="••••••••" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="w-full" type="submit" disabled={isPending}>
          {t('auth.register.signUp')}
        </Button>
      </form>
    </Form>
  )
}
