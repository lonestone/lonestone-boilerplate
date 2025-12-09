import { client } from '@lonestone/openapi-generator'
import * as Linking from 'expo-linking'
import { config } from '@/config/env.config'
import { authClient } from './auth-client'

const expoOrigin = Linking.createURL('', { scheme: 'lonestone' })

async function buildAuthHeaders() {
  const headers: Record<string, string> = {
    'expo-origin': expoOrigin,
    'x-skip-oauth-proxy': 'true',
  }

  const cookies = authClient.getCookie?.()
  const cookieHeader = cookies?.trim()?.replace(/^;\s*/, '')
  if (cookieHeader) {
    headers.cookie = cookieHeader
    headers.Cookie = cookieHeader
  }

  const session = await authClient.getSession()
  if (session?.data?.session?.token) {
    headers.Authorization = `Bearer ${session.data.session.token}`
  }

  return headers
}

// Configure the OpenAPI client for all API calls
client.setConfig({
  baseUrl: config.apiUrl,
  credentials: 'omit',
  // Custom fetch to inject auth headers on every request
  fetch: async (request) => {
    const authHeaders = await buildAuthHeaders()
    const mergedHeaders = new Headers(request.headers)
    for (const [key, value] of Object.entries(authHeaders)) {
      if (value)
        mergedHeaders.set(key, value)
    }

    const finalRequest = new Request(request, { headers: mergedHeaders })
    return fetch(finalRequest)
  },
})

export { client }
