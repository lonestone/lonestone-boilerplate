FROM node:22.14-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS prod-deps

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web-ssr/package.json ./apps/web-ssr/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/openapi-generator/package.json ./packages/openapi-generator/package.json

RUN pnpm fetch --prod

# 🔹 Stage 2: Build
FROM base AS builder

WORKDIR /app

# Define build arguments
ARG API_URL
ENV API_URL=${API_URL}

# Copy project files (without node_modules)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json tsconfig.base.json ./
COPY apps/web-ssr/package.json ./apps/web-ssr/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/openapi-generator/package.json ./packages/openapi-generator/package.json

RUN pnpm fetch

COPY packages/ui ./packages/ui
COPY packages/openapi-generator ./packages/openapi-generator
COPY apps/web-ssr ./apps/web-ssr

# Build packages and SSR application
RUN pnpm build
RUN pnpm deploy --filter="./apps/web-ssr" --prod /prop/web-ssr

# 🔹 Stage 3: Production (Final image)
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