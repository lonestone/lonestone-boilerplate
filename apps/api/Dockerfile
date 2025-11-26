# Stage 1: base
FROM node:22.14-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Use pnpm version according to our package.json, if not the pnpm store will not be in synced later on, resulting in errors
RUN corepack enable && corepack prepare pnpm@10.5.0 --activate
WORKDIR /app

# Stage 2: Installing deps, building and deploying
FROM base AS builder
# pnpm fetch does require only lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm fetch

# Copy source after fetch
COPY . .
RUN pnpm install -r --offline --prefer-offline

RUN pnpm --filter {apps/api}... build

# Create a deploy folder with only the required deps
# This respects gitignore in /apps/api, so remember to include your dist folder in the "files" section of your package.json
RUN pnpm deploy --legacy --filter="./apps/api" --prod /app/api

# Stage 4: Production (Final image)
FROM base AS runner

WORKDIR /app

# Set environment
ENV NODE_ENV=production

COPY --from=builder /app/api/node_modules ./node_modules
COPY --from=builder /app/api/dist ./dist
COPY --from=builder /app/api/package.json ./package.json

# Expose port
EXPOSE 3000

ENV MIKRO_ORM_CLI_USE_TS_NODE=false
ENV MIKRO_ORM_CLI_CONFIG=dist/src/config/mikro-orm.config.js

# Start the application
CMD ["sh", "-c", "pnpm db:migrate:up && pnpm run start"]