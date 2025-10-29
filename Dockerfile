# ========================================
# Multi-stage Dockerfile for moverz_dashboard ETL
# Node.js 20 Alpine (lightweight, ~50MB final image)
# ========================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json tsconfig.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY etl/ ./etl/
COPY db/ ./db/
COPY scripts/ ./scripts/

# Build TypeScript
RUN npm run build

# ========================================
# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built code from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Healthcheck (optionnel, pour CapRover)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#   CMD node -e "console.log('healthy')" || exit 1

# Default: run ETL once and exit (process court)
CMD ["node", "dist/etl/gsc/fetch-simple.js"]

# Labels pour metadata
LABEL maintainer="guillaume@moverz.io"
LABEL version="1.0.0"
LABEL description="Moverz Analytics ETL - Google Search Console → BigQuery"

