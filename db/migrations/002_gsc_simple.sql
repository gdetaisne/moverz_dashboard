-- ========================================
-- Migration 002: Table gsc_daily_metrics (V1 Simple)
-- ========================================
-- Table unique pour GSC avec partitionnement + clustering
-- Compatible avec migration future vers multi-tables

-- Table principale (partitionnée par date, clusterisée par domain/page)
CREATE TABLE IF NOT EXISTS `${GCP_PROJECT_ID}.${BQ_DATASET}.gsc_daily_metrics` (
  -- Dimensions
  date DATE NOT NULL,
  domain STRING NOT NULL,
  page STRING NOT NULL,
  query STRING NOT NULL,
  
  -- Métriques GSC
  clicks INT64 NOT NULL,
  impressions INT64 NOT NULL,
  ctr FLOAT64 NOT NULL,
  position FLOAT64 NOT NULL,
  
  -- Métadonnées
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY domain, page
OPTIONS(
  description = "Google Search Console metrics (V1 single table)",
  require_partition_filter = TRUE,
  partition_expiration_days = 730  -- 2 ans de rétention
);

-- Index pour performance
-- (Pas de CREATE INDEX en BigQuery, le clustering suffit)

-- ========================================
-- Vue 1 : Agrégation quotidienne par domaine
-- ========================================
CREATE OR REPLACE VIEW `${GCP_PROJECT_ID}.${BQ_DATASET}.gsc_aggregated_daily` AS
SELECT 
  date,
  domain,
  
  -- Métriques agrégées
  SUM(clicks) as total_clicks,
  SUM(impressions) as total_impressions,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as avg_ctr,
  AVG(position) as avg_position,
  
  -- Compteurs
  COUNT(DISTINCT page) as unique_pages,
  COUNT(DISTINCT query) as unique_queries,
  
  -- Métadonnées
  MAX(ingested_at) as last_ingested_at
  
FROM `${GCP_PROJECT_ID}.${BQ_DATASET}.gsc_daily_metrics`
GROUP BY date, domain
ORDER BY date DESC, domain;

-- ========================================
-- Vue 2 : Top pages (derniers 30 jours)
-- ========================================
CREATE OR REPLACE VIEW `${GCP_PROJECT_ID}.${BQ_DATASET}.gsc_pages_summary` AS
WITH recent_data AS (
  SELECT 
    domain,
    page,
    SUM(clicks) as clicks,
    SUM(impressions) as impressions,
    SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr,
    AVG(position) as avg_position
  FROM `${GCP_PROJECT_ID}.${BQ_DATASET}.gsc_daily_metrics`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY domain, page
),
ranked AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (PARTITION BY domain ORDER BY impressions DESC) as rank_impressions,
    ROW_NUMBER() OVER (PARTITION BY domain ORDER BY clicks DESC) as rank_clicks
  FROM recent_data
)
SELECT 
  domain,
  page,
  clicks,
  impressions,
  ctr,
  avg_position,
  rank_impressions,
  rank_clicks
FROM ranked
WHERE rank_impressions <= 100 OR rank_clicks <= 100
ORDER BY domain, impressions DESC;

-- ========================================
-- Vue 3 : Top queries (derniers 30 jours)
-- ========================================
CREATE OR REPLACE VIEW `${GCP_PROJECT_ID}.${BQ_DATASET}.gsc_queries_summary` AS
WITH recent_data AS (
  SELECT 
    domain,
    query,
    SUM(clicks) as clicks,
    SUM(impressions) as impressions,
    SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr,
    AVG(position) as avg_position
  FROM `${GCP_PROJECT_ID}.${BQ_DATASET}.gsc_daily_metrics`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY domain, query
),
ranked AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (PARTITION BY domain ORDER BY impressions DESC) as rank_impressions,
    ROW_NUMBER() OVER (PARTITION BY domain ORDER BY clicks DESC) as rank_clicks
  FROM recent_data
)
SELECT 
  domain,
  query,
  clicks,
  impressions,
  ctr,
  avg_position,
  rank_impressions,
  rank_clicks
FROM ranked
WHERE rank_impressions <= 100 OR rank_clicks <= 100
ORDER BY domain, impressions DESC;

-- ========================================
-- Contraintes & validations (via ASSERT)
-- ========================================
-- BigQuery n'a pas de contraintes CHECK, mais on peut documenter les règles

-- Règles attendues:
-- 1. clicks <= impressions (toujours)
-- 2. ctr = clicks / impressions (cohérence)
-- 3. position >= 1 (position SERP minimale)
-- 4. date <= CURRENT_DATE() (pas de données futures)

-- Validation via requête de QA (à exécuter périodiquement):
-- SELECT COUNT(*) as invalid_rows
-- FROM `${GCP_PROJECT_ID}.${BQ_DATASET}.gsc_daily_metrics`
-- WHERE clicks > impressions OR ctr > 1.0 OR position < 1;

