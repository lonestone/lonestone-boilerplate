import { createAuthClient } from 'better-auth/react' // make sure to import from better-auth/react

const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,

})

export { authClient }
