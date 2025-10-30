-- ========================================
-- Migration 006: Table errors_404_urls + vue delta
-- ========================================
-- Date: 2025-10-30
-- Description: Persistences des URLs 404/410 par scan pour calculs de deltas

-- Table détaillée par URL
CREATE TABLE IF NOT EXISTS `moverz-dashboard.analytics_core.errors_404_urls` (
  -- Identifiants de scan/commit
  scan_id STRING NOT NULL,
  scan_date TIMESTAMP NOT NULL,
  commit_sha STRING,
  branch STRING,
  actor STRING,
  repo STRING,

  -- Clé fonctionnelle
  site STRING NOT NULL,
  path STRING NOT NULL,
  status STRING NOT NULL, -- '404' | '410'

  -- Métadatas
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) PARTITION BY DATE(scan_date)
CLUSTER BY site, path
OPTIONS(
  description="URLs 404/410 par scan pour calculs de deltas",
  partition_expiration_days=730
);

-- Vue: delta entre deux scans (par scan_id)
CREATE OR REPLACE VIEW `moverz-dashboard.analytics_core.v_404_delta_by_scan` AS
WITH latest_scans AS (
  SELECT scan_id, scan_date
  FROM `moverz-dashboard.analytics_core.errors_404_urls`
  GROUP BY scan_id, scan_date
),
scans_ranked AS (
  SELECT scan_id, scan_date,
         ROW_NUMBER() OVER (ORDER BY scan_date DESC) as rn
  FROM latest_scans
)
SELECT * FROM scans_ranked;

-- NOTE: La vue ci-dessus est un helper minimal pour lister les scans; les deltas
-- complets (gains/pertes) seront calculés côté API pour flexibilité.

-- ========================================
-- FIN MIGRATION 006
-- ========================================


