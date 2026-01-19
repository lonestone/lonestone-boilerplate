import type { TouchableOpacityProps } from 'react-native'
import * as React from 'react'
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native'

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

interface ButtonProps extends TouchableOpacityProps {
  children: React.ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  className?: string
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  default: 'bg-primary active:bg-primary/90',
  destructive: 'bg-destructive active:bg-destructive/90',
  outline: 'border border-input bg-background active:bg-accent',
  secondary: 'bg-secondary active:bg-secondary/80',
  ghost: 'active:bg-accent',
  link: 'bg-transparent',
}

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  default: 'text-primary-foreground',
  destructive: 'text-white',
  outline: 'text-foreground',
  secondary: 'text-secondary-foreground',
  ghost: 'text-foreground',
  link: 'text-primary underline',
}

const VARIANT_SPINNER: Record<ButtonVariant, string> = {
  default: '#ffffff',
  destructive: '#ffffff',
  outline: '#09090b',
  secondary: '#09090b',
  ghost: '#09090b',
  link: '#0ea5e9',
}

const SIZE_STYLES: Record<ButtonSize, string> = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 px-3 gap-1.5',
  lg: 'h-10 px-6',
  icon: 'w-9 h-9',
}

const SIZE_TEXT: Record<ButtonSize, string> = {
  default: 'text-sm',
  sm: 'text-sm',
  lg: 'text-sm',
  icon: 'text-sm',
}

export function Button({
  children,
  variant = 'default',
  size = 'default',
  isLoading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className={`flex-row items-center justify-center gap-2 rounded-md ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {isLoading
        ? (
            <ActivityIndicator size="small" color={VARIANT_SPINNER[variant]} />
          )
        : (
            <Text
              className={`font-medium ${VARIANT_TEXT[variant]} ${SIZE_TEXT[size]}`}
            >
              {children}
            </Text>
          )}
    </TouchableOpacity>
  )
}
