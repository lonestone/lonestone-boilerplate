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
import { Link } from 'react-router'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export type AuthLoginFormData = z.infer<typeof loginSchema>

interface AuthLoginFormProps {
  onSubmit: (data: AuthLoginFormData) => void
  isPending: boolean
}

export const AuthLoginForm: React.FC<AuthLoginFormProps> = ({ onSubmit, isPending }) => {
  const { t } = useTranslation()
  const form = useForm<AuthLoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  return (
    <Form {...form}>
      <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="email">{t('auth.login.email')}</FormLabel>
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
              <div className="flex justify-between">
                <FormLabel htmlFor="password">{t('auth.login.password')}</FormLabel>
                <Link className="text-sm text-muted-foreground" to="/forgot-password">
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <FormControl>
                <Input id="password" {...field} autoComplete="current-password" placeholder="••••••••" type="password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button className="w-full" type="submit" disabled={isPending}>
          {t('auth.login.signIn')}
        </Button>
      </form>
    </Form>
  )
}
