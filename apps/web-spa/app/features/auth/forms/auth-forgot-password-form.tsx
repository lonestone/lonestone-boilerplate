import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@lonestone/ui/components/primitives/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@lonestone/ui/components/primitives/form'
import { Input } from '@lonestone/ui/components/primitives/input'
import React from 'react'
import { useForm } from 'react-hook-form'
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
              <FormLabel htmlFor="email">Email</FormLabel>
              <FormControl>
                <Input id="email" {...field} type="email" autoComplete="email" placeholder="your@email.com" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          Send Reset Link
        </Button>
      </form>
    </Form>
  )
}
