FROM node:22.14-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS prod-deps

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web-spa/package.json ./apps/web-spa/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/openapi-generator/package.json ./packages/openapi-generator/package.json

RUN pnpm fetch --prod

# 🔹 Stage 2: Build
FROM base AS builder

WORKDIR /app

# Define build arguments
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Copy project files (without node_modules)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json tsconfig.base.json ./
COPY apps/web-spa/package.json ./apps/web-spa/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/openapi-generator/package.json ./packages/openapi-generator/package.json

RUN pnpm fetch

COPY packages/ui ./packages/ui
COPY packages/openapi-generator ./packages/openapi-generator
COPY apps/web-spa ./apps/web-spa

# Build packages and web-spa
RUN pnpm build
RUN pnpm deploy --filter="./apps/web-spa" --prod /prop/web-spa

# 🔹 Stage 3: Production (Final image with Nginx)
FROM nginx:alpine

# Copy nginx configuration for SPAs (redirect to index.html)
COPY apps/web-spa/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build files to nginx directory
COPY --from=builder /app/apps/web-spa/build/client /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]