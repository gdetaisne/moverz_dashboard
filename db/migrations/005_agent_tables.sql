-- ========================================
-- MIGRATION 005: TABLES AGENTS IA
-- ========================================
-- Date: 2025-10-30
-- Description: Tables pour persistance des agents IA (runs + insights)

-- ----------------------------------------
-- 1. TABLE AGENT_RUNS (journal des exécutions)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `moverz-dashboard.analytics_core.agent_runs` (
  id STRING NOT NULL,
  agent_name STRING NOT NULL,
  executed_at TIMESTAMP NOT NULL,
  duration_seconds FLOAT64 NOT NULL,
  status STRING NOT NULL, -- 'success' | 'failed'
  site STRING,            -- null si global
  data JSON,              -- payload brut (court <= 200KB)
  error STRING,           -- null si global
  created_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(executed_at)
CLUSTER BY agent_name, status
OPTIONS(
  description="Journal des exécutions d'agents IA",
  partition_expiration_days=730
);

-- ----------------------------------------
-- 2. TABLE AGENT_INSIGHTS (insights normalisés multi-agents)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `moverz-dashboard.analytics_core.agent_insights` (
  id STRING NOT NULL,
  run_date DATE NOT NULL,
  site STRING NOT NULL,         -- 'marseille' | 'toulouse' | '*global*'
  agent STRING NOT NULL,         -- 'traffic' | 'seo' | 'content' | 'report' | ...
  severity STRING NOT NULL,      -- 'info' | 'warn' | 'critical'
  title STRING NOT NULL,
  summary STRING NOT NULL,
  payload JSON NOT NULL,         -- détails (tableaux/urls/queries)
  evidence JSON,                 -- chiffres utilisés (avant/après delta, etc.)
  suggested_actions JSON,        -- [{priority, title, impact, effort}]
  score FLOAT64,                 -- 0..1 (pour trier par importance)
  created_at TIMESTAMP NOT NULL
)
PARTITION BY run_date
CLUSTER BY site, agent, severity
OPTIONS(
  description="Insights normalisés produits par les agents IA",
  partition_expiration_days=730
);

-- ========================================
-- INDEX & VUES
-- ========================================

-- Vue : derniers insights par agent
CREATE OR REPLACE VIEW `moverz-dashboard.analytics_core.v_latest_insights` AS
SELECT 
  id,
  run_date,
  site,
  agent,
  severity,
  title,
  summary,
  score,
  created_at
FROM `moverz-dashboard.analytics_core.agent_insights`
WHERE run_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
ORDER BY run_date DESC, score DESC;

-- Vue : stats agents (taux succès, durée moyenne)
CREATE OR REPLACE VIEW `moverz-dashboard.analytics_core.v_agent_stats` AS
SELECT 
  agent_name,
  COUNT(*) as total_runs,
  COUNTIF(status = 'success') as success_count,
  COUNTIF(status = 'failed') as failed_count,
  ROUND(COUNTIF(status = 'success') / COUNT(*) * 100, 1) as success_rate,
  ROUND(AVG(duration_seconds), 2) as avg_duration_seconds,
  MAX(executed_at) as last_run_at
FROM `moverz-dashboard.analytics_core.agent_runs`
WHERE executed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY agent_name
ORDER BY last_run_at DESC;

-- ========================================
-- FIN MIGRATION 005
-- ========================================

