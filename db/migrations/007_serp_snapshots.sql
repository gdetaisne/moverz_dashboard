-- ========================================
-- MIGRATION 007: TABLE SERP SNAPSHOTS
-- ========================================
-- Date: 2025-01-02
-- Description: Table pour sauvegarder les snapshots SERP avec métriques et intent

CREATE TABLE IF NOT EXISTS `moverz-dashboard.analytics_core.serp_snapshots` (
  -- Identifiants
  snapshot_id STRING NOT NULL,
  snapshot_date DATE NOT NULL,
  domain STRING NOT NULL,
  page_url STRING NOT NULL,
  
  -- Métriques GSC (au moment du snapshot)
  impressions INT64,
  clicks INT64,
  ctr FLOAT64,
  position FLOAT64,
  share_pct FLOAT64, -- % du total impressions
  
  -- Intent & scores
  intent STRING, -- intent final (déclaré ou déduit)
  intent_declared STRING, -- intent déclaré (meta/JSON-LD)
  intent_inferred STRING, -- intent déduit du contenu
  intent_source STRING, -- 'meta' | 'jsonld' | 'inferred' | null
  intent_match_score FLOAT64, -- 0-100
  
  -- Rich Results
  has_faq BOOL,
  has_aggregate_rating BOOL,
  has_breadcrumb BOOL,
  has_howto BOOL,
  has_article BOOL,
  has_video BOOL,
  has_local_business BOOL,
  score_rich_results FLOAT64, -- 0-100
  
  -- Length scores
  score_length FLOAT64, -- 0-100 (binaire conservateur)
  title_length INT64,
  description_length INT64,
  
  -- Fiabilité fetch
  fetch_success BOOL,
  fetch_status_code INT64,
  fetch_redirected BOOL,
  
  -- Métadonnées
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY snapshot_date
CLUSTER BY domain, intent
OPTIONS(
  description="Snapshots SERP avec métriques et intent pour tracking évolution",
  partition_expiration_days=365 -- 1 an de rétention
);

-- Index composite pour requêtes fréquentes
-- (clustering suffit, pas de CREATE INDEX en BigQuery)

-- Vue: Top pages par intent (dernier snapshot)
CREATE OR REPLACE VIEW `moverz-dashboard.analytics_core.serp_top_by_intent` AS
WITH latest_snapshot AS (
  SELECT 
    snapshot_date,
    MAX(snapshot_date) OVER () as latest_date
  FROM `moverz-dashboard.analytics_core.serp_snapshots`
  WHERE snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
)
SELECT 
  s.domain,
  s.intent,
  s.page_url,
  s.impressions,
  s.clicks,
  s.ctr,
  s.position,
  s.intent_match_score,
  s.score_length,
  s.score_rich_results,
  s.snapshot_date
FROM `moverz-dashboard.analytics_core.serp_snapshots` s
INNER JOIN latest_snapshot ls ON s.snapshot_date = ls.latest_date
WHERE s.intent IS NOT NULL
ORDER BY s.domain, s.intent, s.impressions DESC;

