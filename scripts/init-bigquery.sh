#!/bin/bash
# ========================================
# Script d'initialisation BigQuery
# ========================================
# Créé le dataset et la table gsc_daily_metrics
#
# Usage:
#   GCP_PROJECT_ID=moverz-dashboard BQ_DATASET=analytics_core ./scripts/init-bigquery.sh

set -e

PROJECT_ID=${GCP_PROJECT_ID:-"moverz-dashboard"}
DATASET=${BQ_DATASET:-"analytics_core"}
TABLE="gsc_daily_metrics"

echo "🔧 Initialisation BigQuery..."
echo "   Project: $PROJECT_ID"
echo "   Dataset: $DATASET"
echo ""

# 1. Créer le dataset (EU region)
echo "📦 Creating dataset $DATASET..."
bq mk --location=EU --dataset "$PROJECT_ID:$DATASET" 2>/dev/null || echo "   ℹ️  Dataset already exists"

# 2. Créer la table gsc_daily_metrics
echo "📊 Creating table $TABLE..."
bq mk \
  --table \
  --location=EU \
  --time_partitioning_field=date \
  --clustering_fields=domain,page \
  --description="Google Search Console metrics (V1 single table)" \
  "$PROJECT_ID:$DATASET.$TABLE" \
  date:DATE,domain:STRING,page:STRING,query:STRING,clicks:INTEGER,impressions:INTEGER,ctr:FLOAT,position:FLOAT,ingested_at:TIMESTAMP

echo ""
echo "✅ BigQuery setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Set APP_MODE=etl in CapRover"
echo "   2. Restart the app"
echo ""

