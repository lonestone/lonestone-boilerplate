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
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export type AuthRegisterFormData = z.infer<typeof registerSchema>

interface AuthRegisterFormProps {
  onSubmit: (data: AuthRegisterFormData) => void
  isPending: boolean
}

export const AuthRegisterForm: React.FC<AuthRegisterFormProps> = ({ onSubmit, isPending }) => {
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
              <FormLabel htmlFor="name">Name</FormLabel>
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
              <FormLabel htmlFor="email">Email</FormLabel>
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
        <Button className="w-full" type="submit" disabled={isPending}>
          Sign Up
        </Button>
      </form>
    </Form>
  )
}
