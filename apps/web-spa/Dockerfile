# Stage 1: base
FROM node:24.13-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Use pnpm version according to our package.json, if not the pnpm store will not be in synced later on, resulting in errors
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

# Stage 2: Installing deps and building
FROM base AS builder

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

COPY . .
RUN pnpm install --frozen-lockfile

# Build web-spa and its dependencies
RUN pnpm --filter {apps/web-spa}... build

# Stage 3: Production (Final image with Nginx)
FROM nginx:alpine

# Copy nginx configuration for SPAs (redirect to index.html)
COPY apps/web-spa/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build files to nginx directory
COPY --from=builder /app/apps/web-spa/build/client /usr/share/nginx/html

# Runtime injection: replace %VITE_*% placeholders in static assets
COPY apps/web-spa/docker-entrypoint.sh /docker-entrypoint.d/99-replace-env.sh
RUN chmod +x /docker-entrypoint.d/99-replace-env.sh

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
