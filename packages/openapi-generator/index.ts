import {
  type Config,
  createClient as createFetchClient,
} from '@hey-api/client-fetch'
import * as sdk from './client/sdk.gen'

export * from './client/schemas.gen'
export * from './client/types.gen'
export * from './client/zod.gen'

export function createApiClient(config: Config) {
  const fetchClient = createFetchClient({
    ...config,
  })

  fetchClient.interceptors.request.use((request) => {
    return request
  })

  fetchClient.interceptors.error.use((error) => {
    return error
  })

  type SdkFunctions = keyof typeof sdk

  const apiClient = Object.entries(sdk).reduce((acc, [key, func]) => {
    if (typeof func === 'function') {
      // eslint-disable-next-line ts/no-explicit-any
      acc[key as SdkFunctions] = ((options?: any) =>
        // eslint-disable-next-line ts/no-explicit-any
        func({ ...options, client: fetchClient })) as any
    }
    return acc
  }, {} as { [K in SdkFunctions]: typeof sdk[K] })

  return apiClient
}
