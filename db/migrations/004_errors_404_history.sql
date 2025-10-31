-- ========================================
-- Migration 004: Table errors_404_history
-- ========================================
-- Date: 2025-01-XX
-- Description: Historique des scans 404 (évolution temporelle)

-- Table pour stocker l'historique des erreurs 404
CREATE TABLE IF NOT EXISTS `moverz-dashboard.analytics_core.errors_404_history` (
  -- Identifiant
  id STRING NOT NULL,
  
  -- Date/heure du scan
  scan_date TIMESTAMP NOT NULL,
  
  -- Résultats agrégés
  total_sites INT64 NOT NULL,
  total_pages_checked INT64 NOT NULL,
  total_errors_404 INT64 NOT NULL,
  
  -- Détail par site
  sites_results JSON NOT NULL, -- Array de {site, total_checked, errors_404}
  
  -- Métadonnées
  crawl_duration_seconds INT64 NOT NULL,
  created_at TIMESTAMP
) PARTITION BY DATE(scan_date)
OPTIONS(
  description="Historique des scans 404 avec évolution temporelle",
  partition_expiration_days=730 -- 2 ans de rétention
);

-- ========================================
-- Vue agrégée pour évolution temporelle
-- ========================================
CREATE OR REPLACE VIEW `moverz-dashboard.analytics_core.v_errors_404_evolution` AS
SELECT 
  DATE(scan_date) as date,
  COUNT(*) as nb_scans,
  AVG(total_pages_checked) as avg_pages_checked,
  AVG(total_errors_404) as avg_errors_404,
  MAX(total_errors_404) as max_errors_404,
  MIN(total_errors_404) as min_errors_404,
  AVG(crawl_duration_seconds) as avg_duration_seconds
FROM `moverz-dashboard.analytics_core.errors_404_history`
GROUP BY DATE(scan_date)
ORDER BY date DESC;

-- NOTE: Vue v_errors_404_latest_by_site à créer manuellement si nécessaire

-- ========================================
-- FIN MIGRATION 004
-- ========================================

