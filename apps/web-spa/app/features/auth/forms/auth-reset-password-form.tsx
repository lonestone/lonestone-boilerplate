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
import { z } from 'zod'

const resetPasswordSchema = z.object({
  password: z.string().min(6),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type AuthResetPasswordFormData = z.infer<typeof resetPasswordSchema>

interface AuthResetPasswordFormProps {
  onSubmit: (data: AuthResetPasswordFormData) => void
  isPending: boolean
}

export const AuthResetPasswordForm: React.FC<AuthResetPasswordFormProps> = ({ onSubmit, isPending }) => {
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
              <FormLabel htmlFor="password">Password</FormLabel>
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
              <FormLabel htmlFor="confirmPassword">Confirm Password</FormLabel>
              <FormControl>
                <Input id="confirmPassword" {...field} type="password" autoComplete="new-password" placeholder="••••••••" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          Reset Password
        </Button>
      </form>
    </Form>
  )
}
