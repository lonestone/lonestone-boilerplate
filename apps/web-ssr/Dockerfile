# Stage 1: base
FROM node:22.14-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Use pnpm version according to our package.json, if not the pnpm store will not be in synced later on, resulting in errors
RUN corepack enable && corepack prepare pnpm@10.5.0 --activate
WORKDIR /app

# Stage 2: Installing deps, building and deploying
FROM base AS builder

# Define build arguments
ARG API_URL
ENV API_URL=${API_URL}

# pnpm fetch does require only lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch

# Copy source after fetch
COPY . .
RUN pnpm install -r --offline --prefer-offline

# Build web-ssr and its dependencies
RUN pnpm --filter {apps/web-ssr}... build

# Create a deploy folder with only the required deps
# This respects gitignore in /apps/web-ssr, so remember to include your dist folder in the "files" section of your package.json
RUN pnpm deploy --filter="./apps/web-ssr" --prod /prop/web-ssr

# Stage 3: Production (Final image)
FROM base AS runner

WORKDIR /app

# Set environment
ENV NODE_ENV=production

COPY --from=builder /prop/web-ssr/node_modules ./node_modules
COPY --from=builder /prop/web-ssr/build ./build
COPY --from=builder /prop/web-ssr/package.json ./package.json

# Expose port
EXPOSE 3000

# Start the application
CMD ["pnpm", "run", "start"]