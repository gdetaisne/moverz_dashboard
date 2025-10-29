-- Migration 003: Nouvelle table gsc_daily_aggregated (agrégée par date/domain uniquement)
-- Cette structure évite le filtrage des clics par Google (privacy threshold)
-- Note: On garde l'ancienne table gsc_daily_metrics en parallèle pour comparaison

-- Créer nouvelle table avec schéma simplifié
CREATE TABLE IF NOT EXISTS `moverz-dashboard.analytics_core.gsc_daily_aggregated` (
  date DATE NOT NULL,
  domain STRING NOT NULL,
  clicks INT64 NOT NULL,
  impressions INT64 NOT NULL,
  ctr FLOAT64 NOT NULL,
  position FLOAT64 NOT NULL,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY domain
OPTIONS(
  description="Daily Google Search Console metrics aggregated by domain only (no page/query filtering)",
  expiration_timestamp=TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 2 YEAR)
);

-- Créer vue agrégée par domaine (pour le dashboard)
CREATE OR REPLACE VIEW `moverz-dashboard.analytics_core.gsc_domain_summary_v2` AS
SELECT
  domain,
  SUM(clicks) AS total_clicks,
  SUM(impressions) AS total_impressions,
  AVG(ctr) AS avg_ctr,
  AVG(position) AS avg_position,
  MIN(date) AS first_date,
  MAX(date) AS last_date,
  COUNT(DISTINCT date) AS days_count
FROM `moverz-dashboard.analytics_core.gsc_daily_aggregated`
GROUP BY domain
ORDER BY total_impressions DESC;

