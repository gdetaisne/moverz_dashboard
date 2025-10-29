#!/bin/sh

# ========================================
# Entrypoint script for moverz_dashboard
# Supports 2 modes: ETL or Dashboard
# ========================================

set -e

# Default mode: dashboard
MODE=${APP_MODE:-dashboard}

echo "🚀 Starting moverz_dashboard in mode: $MODE"

case "$MODE" in
  etl)
    echo "📊 Running ETL (Google Search Console → BigQuery)"
    exec npx tsx etl/gsc/fetch-simple.ts
    ;;
    
  dashboard)
    echo "🌐 Starting Dashboard (Next.js on port ${PORT:-3000})"
    cd dashboard
    exec npm start
    ;;
    
  dev)
    echo "🔧 Starting in DEV mode (scheduler)"
    exec npx tsx etl/scheduler.ts
    ;;
    
  *)
    echo "❌ Unknown mode: $MODE"
    echo "Valid modes: etl, dashboard, dev"
    exit 1
    ;;
esac

