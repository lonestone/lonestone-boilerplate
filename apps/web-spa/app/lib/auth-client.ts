import { organizationClient } from 'better-auth/client/plugins'
import { customSessionClient, inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
// oxlint-disable-next-line typescript/ban-ts-comment -- ignore
// @ts-ignore
import type { BetterAuthType } from '../../../api/src/modules/auth/auth.client-types'

const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [
    customSessionClient<BetterAuthType>(),
    inferAdditionalFields<BetterAuthType>(),
    organizationClient(),
  ],
})

export { authClient }
