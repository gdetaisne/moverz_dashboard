-- ========================================
-- Migration 004: Table errors_404_history
-- ========================================
-- Date: 2025-01-XX
-- Description: Historique des scans 404 (évolution temporelle)

-- Table pour stocker l'historique des erreurs 404
CREATE TABLE IF NOT EXISTS `moverz.errors_404_history` (
  -- Identifiant
  id STRING NOT NULL,
  
  -- Date/heure du scan
  scan_date TIMESTAMP NOT NULL,
  
  -- Résultats agrégés
  total_sites INT64 NOT NULL DEFAULT 0,
  total_pages_checked INT64 NOT NULL DEFAULT 0,
  total_errors_404 INT64 NOT NULL DEFAULT 0,
  
  -- Détail par site
  sites_results JSON NOT NULL, -- Array de {site, total_checked, errors_404}
  
  -- Métadonnées
  crawl_duration_seconds INT64 NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) PARTITION BY DATE(scan_date)
OPTIONS(
  description="Historique des scans 404 avec évolution temporelle",
  partition_expiration_days=730 -- 2 ans de rétention
);

-- Clustering pour optimisation des requêtes
ALTER TABLE `moverz.errors_404_history`
SET OPTIONS (
  clustering_fields = "scan_date"
);

-- ========================================
-- Vue agrégée pour évolution temporelle
-- ========================================
CREATE OR REPLACE VIEW `moverz.v_errors_404_evolution` AS
SELECT 
  DATE(scan_date) as date,
  COUNT(*) as nb_scans,
  AVG(total_pages_checked) as avg_pages_checked,
  AVG(total_errors_404) as avg_errors_404,
  MAX(total_errors_404) as max_errors_404,
  MIN(total_errors_404) as min_errors_404,
  AVG(crawl_duration_seconds) as avg_duration_seconds
FROM `moverz.errors_404_history`
GROUP BY DATE(scan_date)
ORDER BY date DESC;

-- ========================================
-- Vue pour dernier scan par site
-- ========================================
CREATE OR REPLACE VIEW `moverz.v_errors_404_latest_by_site` AS
WITH latest_scan AS (
  SELECT 
    id,
    scan_date,
    total_sites,
    total_pages_checked,
    total_errors_404,
    sites_results
  FROM `moverz.errors_404_history`
  WHERE scan_date = (
    SELECT MAX(scan_date) 
    FROM `moverz.errors_404_history`
  )
  LIMIT 1
)
SELECT 
  site.site,
  site.total_checked,
  site.errors_404,
  SAFE_DIVIDE(site.errors_404, site.total_checked) * 100 as error_rate_percent
FROM latest_scan,
UNNEST(JSON_EXTRACT_ARRAY(sites_results)) as site_obj,
UNNEST([STRUCT(
  JSON_EXTRACT_SCALAR(site_obj, '$.site') as site,
  CAST(JSON_EXTRACT_SCALAR(site_obj, '$.total_checked') AS INT64) as total_checked,
  CAST(JSON_EXTRACT_SCALAR(site_obj, '$.errors_404') AS INT64) as errors_404
)]) as site
ORDER BY site.errors_404 DESC;

-- ========================================
-- FIN MIGRATION 004
-- ========================================

