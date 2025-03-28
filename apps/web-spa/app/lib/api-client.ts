import { createApiClient } from '@lonestone/openapi-generator'

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL,
  credentials: 'include',
} as const)
