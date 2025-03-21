# Stage 1: base
FROM node:22.14-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS prod-deps

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm fetch --prod

# 🔹 Stage 2: Build
FROM base AS builder

WORKDIR /app

# Install necessary system dependencies
RUN apk add --no-cache jq

# Copy project files (without node_modules)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/package.json

RUN pnpm fetch

COPY apps/api ./apps/api

# If using MikroORM, disable useTsNode for production
RUN if grep -q "mikro-orm" apps/api/package.json; then \
    cd apps/api && \
    jq '.["mikro-orm"].useTsNode = false' package.json > tmp.json && mv tmp.json package.json && \
    cd ../..; \
    fi

# Build shared packages and API
RUN pnpm build
RUN pnpm deploy --filter="./apps/api" --prod /prop/api

# 🔹 Stage 3: Production (Final image)
FROM base AS runner

WORKDIR /app

# Set environment
ENV NODE_ENV=production

COPY --from=builder /prop/api/node_modules ./node_modules
COPY --from=builder /prop/api/dist ./dist
COPY --from=builder /prop/api/package.json ./package.json

# Expose port
EXPOSE 3000

# Start the application
CMD ["sh", "-c", "pnpm db:migrate:up --config=dist/config/mikro-orm.config.js && pnpm run start"]