import { redirect } from 'react-router'

const SPA_URL = import.meta.env.VITE_SPA_URL ?? 'http://localhost:5174'

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url)
  return redirect(`${SPA_URL}/login${url.search}`)
}

export default function LoginRedirect() {
  return null
}
