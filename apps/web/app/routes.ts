import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("features/welcome/welcome-page.tsx"),
  layout("features/dashboard/dashboard-layout.tsx", [
    index("features/posts/posts-list-page.tsx"),
    // route("posts/new", "features/posts/post-create-page.tsx"),
    // route("posts/:id/edit", "features/posts/post-edit-page.tsx")
  ]),
  layout("features/auth/auth-layout.tsx", [
    route("login", "features/auth/auth-login-page.tsx"),
    route("register", "features/auth/auth-register-page.tsx")
  ])
] satisfies RouteConfig;
