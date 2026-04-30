# Stage 1: base
FROM node:24.13-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Use pnpm version according to our package.json, if not the pnpm store will not be in synced later on, resulting in errors
RUN corepack enable && corepack prepare pnpm@10.5.0 --activate
WORKDIR /app

# Define arguments
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Stage 2: Installing deps, building and deploying
FROM base AS builder

COPY . .
RUN pnpm install --frozen-lockfile

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