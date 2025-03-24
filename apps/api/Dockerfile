# Stage 1: base
FROM node:22.14-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Stage 2: Production dependencies
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/package.json

# COPY PACKAGES DEPENDANCIES
# COPY packages/*/package.json ./packages/*/package.json

RUN pnpm fetch --prod

# Stage 3: Build
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm fetch

# COPY PACKAGES DEPENDANCIES
# COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm build
RUN pnpm deploy --filter="./apps/api" --prod /app/api

# Stage 4: Production (Final image)
FROM base AS runner

WORKDIR /app

# Set environment
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/api/dist ./dist
COPY --from=builder /app/api/package.json ./package.json

# Expose port
EXPOSE 3000

ENV MIKRO_ORM_CLI_USE_TS_NODE=false
ENV MIKRO_ORM_CLI_CONFIG=dist/config/mikro-orm.config.js

# Start the application
CMD ["sh", "-c", "pnpm db:migrate:up && pnpm run start"]