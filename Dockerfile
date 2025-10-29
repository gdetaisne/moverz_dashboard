# ========================================
# Dockerfile for moverz_dashboard ETL (CapRover)
# Node.js 20 Alpine - Single stage avec tsx runtime
# ========================================

FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules (Google Cloud SDK)
RUN apk add --no-cache python3 make g++

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install ALL dependencies (tsx needed for runtime)
RUN npm ci && \
    npm cache clean --force

# Copy source code
COPY etl/ ./etl/
COPY db/ ./db/
COPY scripts/ ./scripts/
COPY tsconfig.json ./

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Healthcheck (pour CapRover monitoring)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Default: run ETL once with tsx (no build needed)
CMD ["npx", "tsx", "etl/gsc/fetch-simple.ts"]

# Labels pour metadata
LABEL maintainer="guillaume@moverz.io"
LABEL version="1.0.0"
LABEL description="Moverz Analytics ETL - Google Search Console → BigQuery"

