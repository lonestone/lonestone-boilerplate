import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@lonestone/ui/components/primitives/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@lonestone/ui/components/primitives/form'
import { Input } from '@lonestone/ui/components/primitives/input'
import React from 'react'
import { useForm } from 'react-hook-form'
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
              <div className="flex justify-between">
                <FormLabel htmlFor="password">Password</FormLabel>
                <Link className="text-sm text-muted-foreground" to="/forgot-password">
                  Forgot password?
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
          Sign In
        </Button>
      </form>
    </Form>
  )
}
