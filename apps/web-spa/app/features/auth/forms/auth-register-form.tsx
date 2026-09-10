import { Button } from '@pitchkit/ui/components/primitives/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@pitchkit/ui/components/primitives/form'
import { Input } from '@pitchkit/ui/components/primitives/input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

const baseRegisterSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(6),
  password: z.string().min(6),
  confirmPassword: z.string(),
})

function getRegisterSchema(t: (key: string) => string) {
  return baseRegisterSchema.refine((data) => data.password === data.confirmPassword, {
    message: t('errorCodes.PASSWORDS_DO_NOT_MATCH'),
    path: ['confirmPassword'],
  })
}

export type AuthRegisterFormData = z.infer<typeof baseRegisterSchema>

interface AuthRegisterFormProps {
  onSubmit: (data: AuthRegisterFormData) => void
  isPending: boolean
  defaultEmail?: string
}

export const AuthRegisterForm: React.FC<AuthRegisterFormProps> = ({
  onSubmit,
  isPending,
  defaultEmail,
}) => {
  const { t } = useTranslation()
  const registerSchema = getRegisterSchema(t)
  const form = useForm<AuthRegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: defaultEmail ?? '',
      firstName: '',
      lastName: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  })

  return (
    <Form {...form}>
      <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <FormMessage />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="firstName">{t('auth.register.firstName')}</FormLabel>
                <FormControl>
                  <Input id="firstName" {...field} autoComplete="given-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="lastName">{t('auth.register.lastName')}</FormLabel>
                <FormControl>
                  <Input id="lastName" {...field} autoComplete="family-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="phone">{t('auth.register.phone')}</FormLabel>
              <FormControl>
                <Input id="phone" {...field} type="tel" autoComplete="tel" />
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
                <Input
                  id="email"
                  {...field}
                  type="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                />
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
                <Input
                  id="password"
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
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
                <Input
                  id="confirmPassword"
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
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
