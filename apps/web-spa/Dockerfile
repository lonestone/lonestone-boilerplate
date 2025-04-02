# Stage 1: base
FROM node:22.14-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Use pnpm version according to our package.json, if not the pnpm store will not be in synced later on, resulting in errors
RUN corepack enable && corepack prepare pnpm@10.5.0 --activate
WORKDIR /app

# Stage 2: Production dependencies
FROM base AS prod-deps
# pnpm fetch does require only lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch --prod

# Stage 3: Build
FROM base AS builder

# Define build arguments
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# pnpm fetch does require only lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch

# Copy source after fetch
COPY . .
RUN pnpm install -r --offline --prefer-offline

# Build web-spa and its dependencies
RUN pnpm --filter {apps/web-spa}... build

# Create a deploy folder with only the required deps
# This respects gitignore in /apps/web-spa, so remember to include your dist folder in the "files" section of your package.json
RUN pnpm deploy --filter="./apps/web-spa" --prod /prop/web-spa

# Stage 4: Production (Final image with Nginx)
FROM nginx:alpine

# Copy nginx configuration for SPAs (redirect to index.html)
COPY apps/web-spa/nginx.conf /etc/nginx/conf.d/default.conf

# Copy build files to nginx directory
COPY --from=builder /app/apps/web-spa/build/client /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]