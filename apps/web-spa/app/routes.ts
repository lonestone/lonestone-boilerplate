import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("features/home/home-redirect.tsx"),
  route("dashboard", "features/dashboard/dashboard-page.tsx", [
    index("features/user-posts/user-posts-page.tsx"),
    route("posts/new", "features/user-posts/user-post-create-page.tsx"),
    route("posts/:userPostId/edit", "features/user-posts/user-post-edit-page.tsx")
  ]),
  layout("features/auth/auth-layout.tsx", [
    route("login", "features/auth/auth-login-page.tsx"),
    route("register", "features/auth/auth-register-page.tsx")
  ])
] satisfies RouteConfig;
