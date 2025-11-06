-- ========================================
-- MIGRATION 009: TABLE SERP METADATA SNAPSHOTS
-- ========================================
-- Date: 2025-11-06
-- Description: Snapshot quotidien des métadonnées SERP avec historique
--              Permet de mesurer la performance des métadonnées dans le temps
--              Option 4 : Métadonnées temps réel + Performances j+2

-- ----------------------------------------
-- TABLE SERP_METADATA_SNAPSHOTS
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS `moverz-dashboard.analytics_core.serp_metadata_snapshots` (
  -- Identifiants
  snapshot_date DATE NOT NULL,           -- Date du snapshot (date de référence)
  url STRING NOT NULL,                    -- URL complète de la page
  
  -- Métadonnées (temps réel, capturées le jour du snapshot)
  metadata_date DATE NOT NULL,            -- Date de capture des métadonnées (= snapshot_date)
  page_type STRING,                       -- Type de page (landing-ville, landing-services, etc.)
  description_template_version STRING,    -- Version du template (v1-landing-ville, v1-services, custom, etc.)
  description_text STRING,                -- Texte complet de la description
  title_text STRING,                      -- Texte complet du title
  title_length INT64,                    -- Longueur du title (caractères)
  description_length INT64,               -- Longueur de la description (caractères)
  length_score INT64,                    -- Score de longueur (0-100)
  
  -- Performances GSC (disponibles j+2, associées à metadata_date)
  gsc_date DATE,                         -- Date des données GSC (NULL si pas encore disponible)
  impressions INT64,                     -- Nombre d'impressions (NULL si pending)
  clicks INT64,                          -- Nombre de clics (NULL si pending)
  ctr FLOAT64,                           -- CTR calculé (NULL si pending)
  position FLOAT64,                      -- Position moyenne (NULL si pending)
  
  -- Autres métadonnées SERP
  intent STRING,                         -- Intent détecté (transactional, informational, etc.)
  intent_source STRING,                  -- Source de l'intent (jsonld, meta, inferred)
  intent_match_score INT64,              -- Score de correspondance intent (0-100)
  rich_results_score INT64,              -- Score Rich Results (0-100)
  has_faq BOOLEAN,                       -- Présence FAQ schema
  has_rating BOOLEAN,                    -- Présence Rating schema
  has_breadcrumb BOOLEAN,                -- Présence Breadcrumb schema
  has_howto BOOLEAN,                     -- Présence HowTo schema
  has_article BOOLEAN,                   -- Présence Article schema
  has_video BOOLEAN,                     -- Présence Video schema
  has_local_business BOOLEAN,            -- Présence LocalBusiness schema
  
  -- Qualité fetch
  fetch_success BOOLEAN,                 -- Fetch réussi
  fetch_status INT64,                    -- Status code HTTP
  redirected BOOLEAN,                    -- Redirection détectée
  
  -- Statut du snapshot
  status STRING NOT NULL,                -- 'pending' | 'complete' | 'error'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY snapshot_date
CLUSTER BY url, page_type, status
OPTIONS(
  description="Snapshots quotidiens des métadonnées SERP avec historique. Métadonnées temps réel, performances GSC j+2.",
  require_partition_filter=TRUE,
  partition_expiration_days=730  -- 2 ans de rétention
);

-- ----------------------------------------
-- VUE : SNAPSHOTS COMPLETS (avec performances)
-- ----------------------------------------
CREATE OR REPLACE VIEW `moverz-dashboard.analytics_core.serp_metadata_snapshots_complete` AS
SELECT *
FROM `moverz-dashboard.analytics_core.serp_metadata_snapshots`
WHERE status = 'complete'
  AND gsc_date IS NOT NULL
  AND impressions IS NOT NULL
ORDER BY snapshot_date DESC, impressions DESC;

-- ----------------------------------------
-- VUE : ÉVOLUTION PAR TEMPLATE
-- ----------------------------------------
CREATE OR REPLACE VIEW `moverz-dashboard.analytics_core.serp_metadata_templates_evolution` AS
SELECT 
  snapshot_date,
  page_type,
  description_template_version,
  COUNT(DISTINCT url) as pages_count,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as avg_ctr,
  AVG(position) as avg_position,
  AVG(length_score) as avg_length_score,
  AVG(rich_results_score) as avg_rich_results_score
FROM `moverz-dashboard.analytics_core.serp_metadata_snapshots`
WHERE status = 'complete'
  AND gsc_date IS NOT NULL
GROUP BY snapshot_date, page_type, description_template_version
ORDER BY snapshot_date DESC, total_impressions DESC;

-- ----------------------------------------
-- VUE : PAGES EN ATTENTE DE COMPLÉTION (j+2)
-- ----------------------------------------
CREATE OR REPLACE VIEW `moverz-dashboard.analytics_core.serp_metadata_snapshots_pending` AS
SELECT 
  snapshot_date,
  COUNT(*) as pending_count,
  COUNT(DISTINCT url) as unique_urls,
  MIN(created_at) as oldest_pending
FROM `moverz-dashboard.analytics_core.serp_metadata_snapshots`
WHERE status = 'pending'
  AND snapshot_date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)  -- Au moins j-1
GROUP BY snapshot_date
ORDER BY snapshot_date DESC;

-- ========================================
-- FIN MIGRATION 009
-- ========================================

