import type { TextInputProps } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'
import React from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry' | 'ref'> {
  label?: string
  error?: string
  helperText?: string
  className?: string
}

export function PasswordInput({ ref, label, error, helperText, className = '', ...props }: PasswordInputProps & { ref?: React.RefObject<TextInput | null> }) {
  const [isFocused, setIsFocused] = React.useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false)

  const borderClass = error
    ? 'border-destructive border-2'
    : isFocused
      ? 'border-ring border-2'
      : 'border-input'

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible)
  }

  return (
    <View className={`gap-2 ${className}`}>
      {label
        ? (
            <Text className="text-sm font-medium text-foreground">
              {label}
            </Text>
          )
        : null}
      <View className="relative">
        <TextInput
          ref={ref}
          className={`rounded-md border bg-background pl-3 pr-12 text-base ${borderClass} ${props.editable === false ? 'opacity-50' : ''}`}
          style={{ height: 48, textAlignVertical: 'center' }}
          placeholderTextColor="#71717a"
          secureTextEntry={!isPasswordVisible}
          onFocus={(event) => {
            setIsFocused(true)
            props.onFocus?.(event)
          }}
          onBlur={(event) => {
            setIsFocused(false)
            props.onBlur?.(event)
          }}
          {...props}
        />
        <Pressable
          onPress={togglePasswordVisibility}
          className="absolute right-3 top-0 h-full items-center justify-center"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isPasswordVisible
            ? (
                <EyeOff size={20} color="#71717a" />
              )
            : (
                <Eye size={20} color="#71717a" />
              )}
        </Pressable>
      </View>
      {error
        ? (
            <Text className="text-sm font-medium text-destructive">{error}</Text>
          )
        : helperText
          ? (
              <Text className="text-sm text-muted-foreground">{helperText}</Text>
            )
          : null}
    </View>
  )
}

PasswordInput.displayName = 'PasswordInput'
