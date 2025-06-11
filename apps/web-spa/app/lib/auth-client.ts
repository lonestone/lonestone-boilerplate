// eslint-disable-next-line ts/ban-ts-comment
// @ts-ignore - We need to import the createAuth function from the api package to infer the type correctly
import type { createBetterAuth } from '../../../api/src/config/better-auth.config'
import { customSessionClient, inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react' // make sure to import from better-auth/react

const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [
    // We need to pass the options to the customSession plugin to infer the session type correctly
    customSessionClient<ReturnType<typeof createBetterAuth>>(),
    // If additional fields have been added to BetterAuth, we infer them
    inferAdditionalFields<ReturnType<typeof createBetterAuth>>(),
  ],
})

export { authClient }
