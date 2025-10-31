-- ========================================
-- Migration 007: Table broken_links
-- ========================================
-- Date: 2025-01-25
-- Description: Liens cassés visibles détectés par scan

-- Table détaillée par lien cassé (source -> target)
CREATE TABLE IF NOT EXISTS `moverz-dashboard.analytics_core.broken_links` (
  -- Identifiants de scan/commit
  scan_id STRING NOT NULL,
  scan_date TIMESTAMP NOT NULL,
  commit_sha STRING,
  branch STRING,
  actor STRING,
  repo STRING,

  -- Lien cassé
  site STRING NOT NULL,
  source_url STRING NOT NULL, -- Page contenant le lien cassé
  target_url STRING NOT NULL, -- URL cassée (404/410)

  -- Métadonnées
  created_at TIMESTAMP
) PARTITION BY DATE(scan_date)
CLUSTER BY site, source_url
OPTIONS(
  description="Liens cassés visibles par scan (source page -> broken URL)",
  partition_expiration_days=730
);

-- NOTE: Index non supporté par BigQuery (utiliser CLUSTER BY)

-- ========================================
-- FIN MIGRATION 007
-- ========================================

