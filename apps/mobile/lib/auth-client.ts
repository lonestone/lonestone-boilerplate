import type { BetterAuthType } from '../../api/src/config/better-auth.config'
import { expoClient } from '@better-auth/expo/client'
import { customSessionClient, inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { config } from '@/config/env.config'
import { AUTH_STORAGE_PREFIX, secureStorageAdapter } from './secure-storage-adapter'

export const authClient = createAuthClient({
  baseURL: config.apiUrl,
  plugins: [
    // @disable-eslint-next-line @typescript-eslint/ban-ts-comment -- BetterAuthType is too complex
    customSessionClient<BetterAuthType>(),
    inferAdditionalFields<BetterAuthType>(),
    expoClient({
      scheme: 'lonestone',
      storagePrefix: AUTH_STORAGE_PREFIX,
      storage: secureStorageAdapter,
    }),
  ],
})
