import { index, layout, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  index('features/home/home-redirect.tsx'),
  route('dashboard', 'features/dashboard/dashboard-page.tsx', [
    index('features/user-posts/user-posts-page.tsx'),
    route('posts/new', 'features/user-posts/user-post-create-page.tsx'),
    route('posts/:userPostId/edit', 'features/user-posts/user-post-edit-page.tsx'),
  ]),
  layout('features/auth/components/auth-layout.tsx', [
    route('login', 'features/auth/pages/auth-login-page.tsx'),
    route('register', 'features/auth/pages/auth-register-page.tsx'),
    route('verify-email', 'features/auth/pages/auth-verify-email-page.tsx'),
    route('forgot-password', 'features/auth/pages/auth-forgot-password-page.tsx'),
    route('reset-password', 'features/auth/pages/auth-reset-password-page.tsx'),
  ]),
] satisfies RouteConfig
