# Image de base avec Node.js et pnpm préinstallé
FROM node:20-alpine AS node-pnpm
RUN npm install -g pnpm

# 🔹 Étape 1 : Installation des dépendances
FROM node-pnpm AS deps

WORKDIR /app

# Copier uniquement les fichiers nécessaires pour l'installation des dépendances
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Créer la structure de répertoires pour les packages
RUN mkdir -p packages/validations apps/api

# Copier les package.json
COPY packages/validations/package.json ./packages/validations/
COPY apps/api/package.json ./apps/api/

# Installer toutes les dépendances (dev + prod) avec hoisting
RUN pnpm install --frozen-lockfile --shamefully-hoist

# 🔹 Étape 2 : Installation des dépendances de production uniquement
FROM node-pnpm AS prod-deps

WORKDIR /app

# Copier uniquement les fichiers nécessaires pour l'installation des dépendances
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Créer la structure de répertoires pour les packages
RUN mkdir -p packages/validations apps/api

# Copier les package.json
COPY packages/validations/package.json ./packages/validations/
COPY apps/api/package.json ./apps/api/

# Installer uniquement les dépendances de production avec hoisting
RUN pnpm install --prod --frozen-lockfile --shamefully-hoist

# 🔹 Étape 3 : Build
FROM node-pnpm AS builder

WORKDIR /app

# Installation des dépendances système nécessaires
RUN apk add --no-cache jq
RUN npm install -g tsup

# Copier les fichiers du projet d'abord (sans les node_modules)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/validations ./packages/validations
COPY apps/api ./apps/api

# Copier les dépendances de l'étape précédente
COPY --from=deps /app/node_modules ./node_modules

# Si vous utilisez MikroORM, désactiver useTsNode pour la production
RUN if grep -q "mikro-orm" apps/api/package.json; then \
    cd apps/api && \
    jq '.["mikro-orm"].useTsNode = false' package.json > tmp.json && mv tmp.json package.json && \
    cd ../..; \
    fi

# Afficher le contenu du package.json de validations pour débogage
RUN echo "Contenu du package.json de validations:" && cat packages/validations/package.json

# Compiler les packages partagés et l'API
RUN cd packages/validations && npx tsup && cd ../.. && pnpm --filter="./apps/api" build

# 🔹 Étape 4 : Production (Image finale)
FROM node-pnpm AS runner

WORKDIR /app

# Définir l'environnement
ENV NODE_ENV=production

# Copier les fichiers de configuration
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/dist ./dist

# Copier les dépendances de production
COPY --from=prod-deps /app/node_modules ./node_modules

# Copier le package validations compilé dans node_modules
COPY --from=builder /app/packages/validations/dist ./node_modules/@lonestone/validations/dist
COPY --from=builder /app/packages/validations/package.json ./node_modules/@lonestone/validations/

# Exposer le port
EXPOSE 3000

# Démarrer l'application
CMD ["sh", "-c", "pnpm db:migrate:up --config=dist/config/mikro-orm.config.js && node dist/main.js"]