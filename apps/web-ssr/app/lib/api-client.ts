import process from 'node:process'
import { createApiClient } from '@lonestone/openapi-generator'

declare global {
  interface Window {
    ENV: {
      API_URL: string
    }
  }
}

const isServer = typeof window === 'undefined'

export const apiClient = createApiClient({
  baseUrl: isServer ? process.env.API_URL : window.ENV.API_URL,
  credentials: 'include',
} as const)
