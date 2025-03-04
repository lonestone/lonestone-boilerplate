import { createAuthClient } from "better-auth/react" // make sure to import from better-auth/react

const authClient = createAuthClient({
   baseURL: "http://localhost:4000",
})

export { authClient };
export const { useSession } = authClient; 