# ========================================
# Dockerfile for moverz_dashboard (ETL + Dashboard)
# Node.js 20 Alpine - Multi-mode: ETL or Dashboard web
# ========================================

FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies for native modules (Google Cloud SDK)
RUN apk add --no-cache python3 make g++

# ========================================
# Stage 1: Install ETL dependencies
# ========================================
FROM base AS etl-deps

COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --no-fund && npm cache clean --force

# ========================================
# Stage 2: Install Dashboard dependencies
# ========================================
FROM base AS dashboard-deps

# Copier seulement package.json pour mettre en cache les deps
COPY dashboard/package*.json ./dashboard/

RUN cd dashboard && npm ci --prefer-offline --no-audit --no-fund && npm cache clean --force

# ========================================
# Stage 3: Build Dashboard
# ========================================
FROM dashboard-deps AS dashboard-builder

# Copier le reste du code seulement après l'installation des deps
COPY dashboard/next.config.js ./dashboard/
COPY dashboard/tailwind.config.ts ./dashboard/
COPY dashboard/postcss.config.js ./dashboard/
COPY dashboard/tsconfig.json ./dashboard/
COPY dashboard/app ./dashboard/app
COPY dashboard/components ./dashboard/components
COPY dashboard/lib ./dashboard/lib
COPY dashboard/public ./dashboard/public
COPY dashboard/data ./dashboard/data

# Build avec variables d'environnement pour optimiser
ARG NODE_ENV=production
ARG NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=$NODE_ENV
ENV NEXT_TELEMETRY_DISABLED=$NEXT_TELEMETRY_DISABLED

# Désactiver sourcemaps en production pour accélérer
RUN cd dashboard && \
    NEXT_TELEMETRY_DISABLED=1 \
    GENERATE_SOURCEMAP=false \
    npm run build

# ========================================
# Stage 4: Production image
# ========================================
FROM base

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy ETL code + dependencies
COPY --from=etl-deps /app/node_modules ./node_modules
COPY --from=etl-deps /app/package*.json ./
COPY etl/ ./etl/
COPY db/ ./db/
COPY scripts/ ./scripts/
COPY tsconfig.json ./

# Copy Dashboard build (mode standalone = plus léger)
# En mode standalone, Next.js crée .next/standalone avec seulement les fichiers nécessaires
COPY --from=dashboard-builder --chown=nodejs:nodejs /app/dashboard/.next/standalone ./dashboard
COPY --from=dashboard-builder --chown=nodejs:nodejs /app/dashboard/.next/static ./dashboard/.next/static
COPY --from=dashboard-builder --chown=nodejs:nodejs /app/dashboard/public ./dashboard/public
# Stratégie business (source de vérité) embarquée pour le chatbot
COPY --from=dashboard-builder --chown=nodejs:nodejs /app/dashboard/data ./dashboard/data

# Le dossier .next/standalone contient déjà node_modules optimisés
# On n'a plus besoin de copier tout dashboard/node_modules

# Copy entrypoint script
COPY start.sh ./
RUN chmod +x start.sh

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose dashboard port (default 3000)
EXPOSE 3000

# Healthcheck (pour CapRover monitoring)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Mode défini via variable d'environnement CapRover
# APP_MODE peut être: etl, dashboard, dev
ENV PORT=3000

CMD ["./start.sh"]

# Labels
LABEL maintainer="guillaume@moverz.io"
LABEL version="1.0.0"
LABEL description="Moverz Analytics - ETL + Dashboard (multi-mode)"

