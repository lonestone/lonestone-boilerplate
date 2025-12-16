/* eslint-disable node/prefer-global/process */
import { z } from 'zod'

export const configValidationSchema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url(),
})

export type ConfigSchema = z.infer<typeof configValidationSchema>

const configParsed = configValidationSchema.safeParse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
})

if (!configParsed.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(
      configParsed.error.format(),
      null,
      2,
    )}`,
  )
}

export const config = {
  apiUrl: configParsed.data.EXPO_PUBLIC_API_URL,
} as const
