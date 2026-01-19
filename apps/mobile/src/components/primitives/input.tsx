import type { TextInputProps } from 'react-native'
import * as React from 'react'
import { Text, TextInput, View } from 'react-native'

interface InputProps extends Omit<TextInputProps, 'ref'> {
  label?: string
  error?: string
  helperText?: string
  className?: string
}

export function Input({ ref, label, error, helperText, className = '', ...props }: InputProps & { ref?: React.RefObject<TextInput | null> }) {
  const [isFocused, setIsFocused] = React.useState(false)

  const borderClass = error
    ? 'border-destructive border-2'
    : isFocused
      ? 'border-ring border-2'
      : 'border-input'

  return (
    <View className={`gap-2 ${className}`}>
      {label
        ? (
            <Text className="text-sm font-medium text-foreground">
              {label}
            </Text>
          )
        : null}
      <TextInput
        ref={ref}
        className={`rounded-md border bg-background px-3 text-base ${borderClass} ${props.editable === false ? 'opacity-50' : ''}`}
        style={{ height: 48, textAlignVertical: 'center' }}
        placeholderTextColor="#71717a"
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

Input.displayName = 'Input'
