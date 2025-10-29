-- ========================================
-- MIGRATION 001: TABLES INITIALES
-- ========================================
-- Date: 2025-10-29
-- Description: Création des tables de base

-- ----------------------------------------
-- 1. TABLE SITES (référentiel)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `moverz.sites` (
  id STRING NOT NULL,
  city STRING NOT NULL,
  domain STRING NOT NULL,
  status STRING NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP
) OPTIONS(
  description="Référentiel des 11 sites Moverz"
);

-- ----------------------------------------
-- 2. TABLE ETL_JOBS_LOG (monitoring)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `moverz.etl_jobs_log` (
  id STRING NOT NULL,
  job_name STRING NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP NOT NULL,
  status STRING NOT NULL, -- 'success', 'partial', 'failed'
  rows_processed INT64 NOT NULL DEFAULT 0,
  errors STRING, -- Erreurs éventuelles (séparées par ';')
  duration_seconds FLOAT64,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) OPTIONS(
  description="Logs des exécutions ETL"
);

-- ----------------------------------------
-- 3. TABLE GSC_GLOBAL (métriques quotidiennes)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `moverz.gsc_global` (
  site STRING NOT NULL,
  date DATE NOT NULL,
  impressions INT64 NOT NULL DEFAULT 0,
  clicks INT64 NOT NULL DEFAULT 0,
  ctr FLOAT64 NOT NULL DEFAULT 0.0,
  position FLOAT64 NOT NULL DEFAULT 0.0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) PARTITION BY date
OPTIONS(
  description="Métriques GSC quotidiennes par site",
  partition_expiration_days=730 -- 2 ans de rétention
);

-- ----------------------------------------
-- 4. TABLE GSC_PAGES (performance par page)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `moverz.gsc_pages` (
  site STRING NOT NULL,
  date DATE NOT NULL,
  url STRING NOT NULL,
  impressions INT64 NOT NULL DEFAULT 0,
  clicks INT64 NOT NULL DEFAULT 0,
  ctr FLOAT64 NOT NULL DEFAULT 0.0,
  position FLOAT64 NOT NULL DEFAULT 0.0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) PARTITION BY date
OPTIONS(
  description="Performance GSC par page et par jour",
  partition_expiration_days=730
);

-- ----------------------------------------
-- 5. TABLE GSC_QUERIES (performance par requête)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `moverz.gsc_queries` (
  site STRING NOT NULL,
  date DATE NOT NULL,
  query STRING NOT NULL,
  impressions INT64 NOT NULL DEFAULT 0,
  clicks INT64 NOT NULL DEFAULT 0,
  ctr FLOAT64 NOT NULL DEFAULT 0.0,
  position FLOAT64 NOT NULL DEFAULT 0.0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) PARTITION BY date
OPTIONS(
  description="Performance GSC par requête et par jour",
  partition_expiration_days=730
);

-- ----------------------------------------
-- 6. TABLE WEB_VITALS (métriques performance)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `moverz.web_vitals` (
  site STRING NOT NULL,
  date DATE NOT NULL,
  url STRING NOT NULL,
  device STRING NOT NULL, -- 'mobile', 'desktop'
  metric STRING NOT NULL, -- 'LCP', 'CLS', 'INP'
  p50 FLOAT64 NOT NULL,
  p75 FLOAT64 NOT NULL,
  p95 FLOAT64 NOT NULL,
  samples INT64 NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) PARTITION BY date
OPTIONS(
  description="Web Vitals agrégés quotidiennement",
  partition_expiration_days=730
);

-- ----------------------------------------
-- 7. TABLE LEADS (conversions)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `moverz.leads` (
  id STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  site STRING NOT NULL,
  source STRING, -- 'organic', 'direct', 'referral'
  medium STRING,
  utm_source STRING,
  utm_medium STRING,
  utm_campaign STRING,
  form_data JSON,
  status STRING NOT NULL, -- 'pending', 'contacted', 'converted', 'lost'
  updated_at TIMESTAMP
) PARTITION BY DATE(created_at)
OPTIONS(
  description="Leads générés via formulaires",
  partition_expiration_days=730
);

-- ----------------------------------------
-- 8. TABLE ALERTS (alertes système)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `moverz.alerts` (
  id STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  severity STRING NOT NULL, -- 'critical', 'warning', 'info'
  site STRING NOT NULL,
  metric STRING NOT NULL,
  message STRING NOT NULL,
  current_value FLOAT64,
  previous_value FLOAT64,
  threshold FLOAT64,
  resolved BOOL NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMP
) PARTITION BY DATE(created_at)
OPTIONS(
  description="Alertes détectées par les agents",
  partition_expiration_days=90
);

-- ========================================
-- INDEX & CONTRAINTES
-- ========================================

-- Pas de PK/FK natifs dans BigQuery, mais on peut créer des index clusterés

-- gsc_global : clustered par site
ALTER TABLE `moverz.gsc_global`
SET OPTIONS (
  clustering_fields = "site"
);

-- gsc_pages : clustered par site, url
ALTER TABLE `moverz.gsc_pages`
SET OPTIONS (
  clustering_fields = "site, url"
);

-- gsc_queries : clustered par site, query
ALTER TABLE `moverz.gsc_queries`
SET OPTIONS (
  clustering_fields = "site, query"
);

-- ========================================
-- FIN MIGRATION 001
-- ========================================

