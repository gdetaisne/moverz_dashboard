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
RUN npm ci && npm cache clean --force

# ========================================
# Stage 2: Install Dashboard dependencies
# ========================================
FROM base AS dashboard-deps

COPY dashboard/package*.json ./dashboard/
RUN cd dashboard && npm ci && npm cache clean --force

# ========================================
# Stage 3: Build Dashboard
# ========================================
FROM dashboard-deps AS dashboard-builder

COPY dashboard ./dashboard
RUN cd dashboard && npm run build

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

# Copy Dashboard build + dependencies
COPY --from=dashboard-builder /app/dashboard/.next ./dashboard/.next
COPY --from=dashboard-builder /app/dashboard/node_modules ./dashboard/node_modules
COPY --from=dashboard-builder /app/dashboard/package*.json ./dashboard/
COPY --from=dashboard-builder /app/dashboard/public ./dashboard/public
COPY --from=dashboard-builder /app/dashboard/next.config.js ./dashboard/

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

# Default: run dashboard web
# Override with ENV APP_MODE=etl for ETL mode
ENV APP_MODE=dashboard
ENV PORT=3000

CMD ["./start.sh"]

# Labels
LABEL maintainer="guillaume@moverz.io"
LABEL version="1.0.0"
LABEL description="Moverz Analytics - ETL + Dashboard (multi-mode)"

