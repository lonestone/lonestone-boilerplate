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
RUN mkdir -p packages/ui packages/validations packages/openapi-generator apps/web-spa

# Copier les package.json des packages nécessaires uniquement
COPY packages/ui/package.json ./packages/ui/
COPY packages/validations/package.json ./packages/validations/
COPY packages/openapi-generator/package.json ./packages/openapi-generator/
COPY apps/web-spa/package.json ./apps/web-spa/

# Installer toutes les dépendances (dev + prod) avec hoisting
RUN pnpm install --frozen-lockfile --shamefully-hoist

# 🔹 Étape 2 : Build
FROM node-pnpm AS builder

WORKDIR /app

# Définir les arguments de build qui peuvent être passés lors de la construction de l'image
ARG VITE_API_URL
ARG VITE_APP_ENV=production
ARG VITE_APP_VERSION
# Autres variables d'environnement spécifiques à votre application
# ARG VITE_FEATURE_FLAG_X
# ARG VITE_ANALYTICS_ID

# Définir les variables d'environnement pour le build
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_APP_ENV=${VITE_APP_ENV}
ENV VITE_APP_VERSION=${VITE_APP_VERSION}
# ENV VITE_FEATURE_FLAG_X=${VITE_FEATURE_FLAG_X}
# ENV VITE_ANALYTICS_ID=${VITE_ANALYTICS_ID}

# Copier uniquement les packages nécessaires
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY packages/ui ./packages/ui
COPY packages/validations ./packages/validations
COPY packages/openapi-generator ./packages/openapi-generator
COPY apps/web-spa ./apps/web-spa

# Copier les dépendances de l'étape précédente
COPY --from=deps /app/node_modules ./node_modules

# Compiler les packages nécessaires et la SPA
RUN pnpm build

# 🔹 Étape 3 : Production (Image finale avec Nginx)
FROM nginx:alpine

# Copie de la configuration nginx pour les SPA (redirection vers index.html)
COPY apps/web-spa/nginx.conf /etc/nginx/conf.d/default.conf

# Copie des fichiers de build dans le répertoire de nginx
COPY --from=builder /app/apps/web-spa/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]