-- ========================================
-- MIGRATION 008: TABLE GSC ISSUES
-- ========================================
-- Date: 2025-01-XX
-- Description: Table pour stocker les problèmes d'indexation détectés par Search Console

CREATE TABLE IF NOT EXISTS `moverz-dashboard.analytics_core.gsc_issues` (
  -- Identifiants
  id STRING NOT NULL,
  issue_date DATE NOT NULL,
  domain STRING NOT NULL,
  
  -- Type de problème
  issue_type STRING NOT NULL, -- 'indexing', 'coverage', 'mobile', 'security', 'rich_results'
  severity STRING NOT NULL, -- 'error', 'warning', 'info'
  status STRING NOT NULL, -- 'open', 'resolved', 'fixed'
  
  -- Détails
  title STRING NOT NULL,
  description STRING,
  affected_pages_count INT64,
  affected_urls JSON, -- Array d'URLs affectées (limité aux 100 premières)
  
  -- Détection
  detected_at TIMESTAMP NOT NULL,
  first_seen TIMESTAMP, -- Première détection (pour historique)
  last_seen TIMESTAMP, -- Dernière détection
  resolved_at TIMESTAMP, -- Date de résolution
  
  -- Métadonnées
  gsc_notification_id STRING, -- ID de notification GSC si disponible
  source STRING DEFAULT 'api', -- 'api' | 'url_inspection' | 'manual'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY issue_date
CLUSTER BY domain, issue_type, severity, status
OPTIONS(
  description="Problèmes d'indexation et alertes Google Search Console",
  partition_expiration_days=730 -- 2 ans de rétention
);

-- Vue: Issues actives (non résolues)
CREATE OR REPLACE VIEW `moverz-dashboard.analytics_core.v_gsc_issues_active` AS
SELECT 
  id,
  issue_date,
  domain,
  issue_type,
  severity,
  title,
  description,
  affected_pages_count,
  affected_urls,
  detected_at,
  first_seen,
  last_seen,
  gsc_notification_id
FROM `moverz-dashboard.analytics_core.gsc_issues`
WHERE status IN ('open', 'warning')
  AND issue_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
ORDER BY 
  CASE severity 
    WHEN 'error' THEN 1 
    WHEN 'warning' THEN 2 
    ELSE 3 
  END,
  detected_at DESC;

-- Vue: Statistiques issues par domaine
CREATE OR REPLACE VIEW `moverz-dashboard.analytics_core.v_gsc_issues_stats` AS
SELECT 
  domain,
  issue_type,
  severity,
  COUNT(*) as issue_count,
  COUNTIF(status = 'open') as open_count,
  COUNTIF(status = 'resolved') as resolved_count,
  MIN(detected_at) as first_detection,
  MAX(last_seen) as last_detection,
  MAX(issue_date) as last_issue_date
FROM `moverz-dashboard.analytics_core.gsc_issues`
WHERE issue_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY domain, issue_type, severity
ORDER BY domain, issue_type, severity;

