# Image de base avec Node.js et pnpm préinstallé
FROM node:20-alpine AS node-pnpm
RUN npm install -g pnpm

# 🔹 Étape 1 : Installation des dépendances
FROM node-pnpm AS deps

WORKDIR /app

# Copier uniquement les fichiers nécessaires pour l'installation des dépendances
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Créer la structure de répertoires pour les packages nécessaires
# Ajoutez ou supprimez des packages selon vos besoins
RUN mkdir -p packages/ui packages/validations packages/openapi-generator apps/web-ssr

# Copier les package.json des packages nécessaires uniquement
COPY packages/ui/package.json ./packages/ui/
COPY packages/validations/package.json ./packages/validations/
COPY packages/openapi-generator/package.json ./packages/openapi-generator/
COPY apps/web-ssr/package.json ./apps/web-ssr/

# Installer toutes les dépendances (dev + prod) avec hoisting
RUN pnpm install --frozen-lockfile --shamefully-hoist

# 🔹 Étape 2 : Installation des dépendances de production uniquement
FROM node-pnpm AS prod-deps

WORKDIR /app

# Copier uniquement les fichiers nécessaires pour l'installation des dépendances
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Créer la structure de répertoires pour les packages nécessaires
RUN mkdir -p packages/ui packages/validations packages/openapi-generator apps/web-ssr

# Copier les package.json des packages nécessaires uniquement
COPY packages/ui/package.json ./packages/ui/
COPY packages/validations/package.json ./packages/validations/
COPY packages/openapi-generator/package.json ./packages/openapi-generator/
COPY apps/web-ssr/package.json ./apps/web-ssr/

# Installer uniquement les dépendances de production avec hoisting
RUN pnpm install --prod --frozen-lockfile --shamefully-hoist

# 🔹 Étape 3 : Build
FROM node-pnpm AS builder

WORKDIR /app

# Copier uniquement les packages nécessaires
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY packages/ui ./packages/ui
COPY packages/validations ./packages/validations
COPY packages/openapi-generator ./packages/openapi-generator
COPY apps/web-ssr ./apps/web-ssr

# Copier les dépendances de l'étape précédente
COPY --from=deps /app/node_modules ./node_modules

# Compiler les packages nécessaires et l'application SSR
RUN pnpm build

# 🔹 Étape 4 : Production (Image finale)
FROM node-pnpm AS runner

WORKDIR /app

# Définir l'environnement
ENV NODE_ENV=production

COPY --from=builder /app/apps/web-ssr/build ./build
COPY --from=builder /app/apps/web-ssr/package.json ./package.json

# Copier les dépendances de production
COPY --from=prod-deps /app/node_modules ./node_modules

# Définir le répertoire de travail pour l'application SSR
WORKDIR /app

# Exposer le port
EXPOSE 3000

# Démarrer l'application
CMD ["pnpm", "run", "start"]