import type { RouteConfig } from '@react-router/dev/routes'
import { index, layout, route } from '@react-router/dev/routes'

export default [
  layout('components/main-layout.tsx', [
    index('features/home/home-page.tsx'),
    route('posts', 'features/posts/posts-list-page.tsx'),
    route('posts/:slug', 'features/posts/post-detail-page.tsx'),
    route('authors/:slug', 'features/authors/author-posts-page.tsx'),
  ]),
] satisfies RouteConfig
