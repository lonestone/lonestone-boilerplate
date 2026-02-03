import type { RouteConfig } from '@react-router/dev/routes'
import { index, layout, route } from '@react-router/dev/routes'

export default [
  index('features/home/home-redirect.tsx'),
  layout('features/dashboard/dashboard-page.tsx', [
    route('dashboard', 'features/examples/user-posts/user-posts-page.tsx'),
    route('dashboard/posts/new', 'features/examples/user-posts/user-post-create-page.tsx'),
    route('dashboard/posts/:userPostId/edit', 'features/examples/user-posts/user-post-edit-page.tsx'),
    route('ai-chat', 'features/examples/ai/ai-chat-page.tsx'),
  ]),
  layout('features/auth/components/auth-layout.tsx', [
    route('login', 'features/auth/pages/auth-login-page.tsx'),
    route('register', 'features/auth/pages/auth-register-page.tsx'),
    route('verify-email', 'features/auth/pages/auth-verify-email-page.tsx'),
    route('forgot-password', 'features/auth/pages/auth-forgot-password-page.tsx'),
    route('reset-password', 'features/auth/pages/auth-reset-password-page.tsx'),
  ]),
] satisfies RouteConfig
