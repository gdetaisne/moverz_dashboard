# 📚 Documentation Complète - Moverz Dashboard

**Version** : 1.0.0  
**Date** : 30 Octobre 2025  
**Dernière mise à jour** : 30 Octobre 2025

---

## 🎯 Vue d'Ensemble

**Moverz Dashboard** est un système analytics complet pour piloter 11 sites de déménagement via données SEO, comportementales et conversions.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SOURCES DE DONNÉES                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Google Search Console (11 domaines)                      │
│     → Impressions, clics, CTR, position                      │
│                                                               │
│  2. Google Analytics 4 (11 streams)                          │
│     → Events: page_view, cta_click, form_start, form_submit │
│                                                               │
│  3. PostgreSQL (Leads)                                       │
│     → Conversions réelles (formulaires)                      │
│                                                               │
│  4. Web Vitals (11 sites)                                    │
│     → LCP, CLS, INP                                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    ETL (Quotidien - 09h)                     │
├─────────────────────────────────────────────────────────────┤
│  • etl/gsc/fetch-simple.ts                                   │
│  • etl/leads/sync.ts                                         │
│  • etl/web-vitals/aggregate.ts                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  BIGQUERY (Data Warehouse)                   │
├─────────────────────────────────────────────────────────────┤
│  Dataset: analytics_core                                     │
│  Tables:                                                     │
│    • gsc_daily_aggregated (SEO quotidien)                   │
│    • errors_404_history (historique 404)                    │
│    • sites (référentiel)                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              DASHBOARD NEXT.JS (Web Interface)               │
├─────────────────────────────────────────────────────────────┤
│  API Routes:                                                 │
│    • /api/metrics/global     → KPIs globaux                 │
│    • /api/metrics/timeseries → Évolution temporelle         │
│    • /api/vitals             → Santé sites                  │
│    • /api/404/scan           → Scan 404                     │
│    • /api/etl/run            → Lancer ETL manuellement      │
│                                                               │
│  Pages:                                                      │
│    • /                       → Vue globale                   │
│    • /vitals                 → Monitoring santé              │
│    • /404                    → Erreurs 404                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 SOURCES DE DONNÉES

### 1. Google Search Console (GSC)

**Fichier ETL** : `etl/gsc/fetch-simple.ts`

**Source** : API Google Search Console  
**Authentification** : Service Account OAuth 2.0

**Données collectées** :
```typescript
interface GSCRow {
  date: string          // YYYY-MM-DD
  domain: string        // devis-demenageur-marseille.fr
  clicks: number        // Nombre de clics
  impressions: number   // Nombre d'impressions
  ctr: number          // Click-Through Rate
  position: number     // Position moyenne
}
```

**Fréquence** : Quotidien (09:00 via `etl/scheduler.ts`)

**Stockage** : 
- **Table BigQuery** : `analytics_core.gsc_daily_aggregated`
- **Partition** : Par date (730 jours de rétention)
- **Cluster** : Par domain

**Note** : La dimension "page" et "query" a été retirée (V2) pour éviter le filtrage Google (privacy threshold).

### 2. Erreurs 404

**Fichier Scan** : `dashboard/app/api/404/scan/route.ts`

**Source** : Crawl direct des 11 sites  
**Méthode** : Fetch HTML + détection status 404

**Données collectées** :
```typescript
interface Error404HistoryEntry {
  id: string
  scan_date: string
  total_sites: number
  total_pages_checked: number
  total_errors_404: number
  sites_results: Array<{
    site: string
    total_checked: number
    errors_404: number
  }>
  crawl_duration_seconds: number
  created_at: string
}
```

**Fréquence** : Manuel (via `/api/404/scan`)

**Stockage** :
- **Table BigQuery** : `analytics_core.errors_404_history`

### 3. Web Vitals (Futur)

**Fichier ETL** : `etl/web-vitals/aggregate.ts` (structure prête, non implémenté)

**Source** : Google Analytics 4 BigQuery Export  
**Métriques** : LCP, CLS, INP

**Fréquence** : Quotidien (11:00 via `etl/scheduler.ts`)

**Stockage prévu** : `analytics_core.web_vitals`

### 4. Leads (Structure prête, non connecté)

**Fichier ETL** : `etl/leads/sync.ts`

**Source** : PostgreSQL (table `leads`)

**Variables requises** :
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

**Fréquence** : Quotidien (10:00 via `etl/scheduler.ts`)

**Stockage prévu** : `analytics_core.leads`

---

## 🔄 FLUX DE DONNÉES

### Flux Principal : ETL → BigQuery → Dashboard

```
1. ETL GSC (09h00 quotidien)
   ↓
   etl/gsc/fetch-simple.ts
   → Fetch API Google Search Console
   → Transform (date, domain, metrics)
   → UPSERT BigQuery (merge on date, domain)
   
2. Dashboard Query
   ↓
   dashboard/app/api/metrics/global/route.ts
   → Query BigQuery (SUM clicks, impressions, AVG ctr/position)
   → Return JSON
   
3. Frontend Display
   ↓
   dashboard/app/page.tsx
   → Fetch /api/metrics/global?days=7
   → Display MetricCard components
```

### Détails du Flux GSC

#### 1. Extraction (`etl/gsc/fetch-simple.ts`)

```typescript
// Fenêtre de dates (GSC a ~48-72h de latence)
const endDate = format(subDays(new Date(), 1), 'yyyy-MM-dd')
const startDate = format(subDays(new Date(), 3), 'yyyy-MM-dd')

// Par domaine
for (const domain of sites) {
  const gscRows = await fetchGSCData(domain, startDate, endDate)
  // → Appelle API: GET https://searchconsole.googleapis.com/v1/urlSearchAnalytics/search
}

// Returns:
// { keys: ['2025-10-28'], clicks: 45, impressions: 1234, ... }
```

#### 2. Transformation

```typescript
const bqRows = transformRows(domain, gscRows)
// → [{ date: '2025-10-28', domain: '...', clicks: 45, ... }]
```

#### 3. Chargement (UPSERT)

```sql
MERGE analytics_core.gsc_daily_aggregated AS target
USING (SELECT ...) AS source
ON target.date = source.date AND target.domain = source.domain
WHEN MATCHED THEN UPDATE SET clicks = source.clicks, ...
WHEN NOT MATCHED THEN INSERT VALUES (...)
```

#### 4. Dashboard (Query)

```sql
-- dashboard/lib/bigquery.ts : getGlobalMetrics()
SELECT 
  domain,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  AVG(ctr) as ctr,
  AVG(position) as position,
  -- Calcul du trend (vs période précédente)
  SAFE_DIVIDE(c.clicks - p.prev_clicks, p.prev_clicks) * 100 as trend_clicks
FROM analytics_core.gsc_daily_aggregated
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY domain
```

---

## 🗄️ STRUCTURE BIGQUERY

### Dataset

**Nom** : `analytics_core`  
**Projet** : `moverz-dashboard`  
**Rétention** : 730 jours (partitions)

### Tables Principales

#### 1. `gsc_daily_aggregated`

**Description** : Métriques GSC quotidiennes agrégées par domaine

**Schéma** :
```sql
date DATE           -- Partition key
domain STRING       -- Clustering key
clicks INT64
impressions INT64
ctr FLOAT64
position FLOAT64
ingested_at TIMESTAMP
```

**Partition** : Par `date` (730 jours)  
**Cluster** : Par `domain`

**Échantillon** :
```
date       | domain                               | clicks | impressions | ctr    | position
-----------|--------------------------------------|--------|-------------|--------|----------
2025-10-28 | devis-demenageur-marseille.fr       | 45     | 1234        | 0.036  | 8.2
2025-10-28 | devis-demenageur-toulouse.fr        | 32     | 987         | 0.032  | 9.1
```

#### 2. `errors_404_history`

**Description** : Historique des scans d'erreurs 404

**Schéma** :
```sql
id STRING
scan_date TIMESTAMP    -- Partition key
total_sites INT64
total_pages_checked INT64
total_errors_404 INT64
sites_results JSON     -- [{ site, total_checked, errors_404 }]
crawl_duration_seconds INT64
created_at TIMESTAMP
```

**Échantillon** :
```json
{
  "id": "scan-20251028-123456",
  "scan_date": "2025-10-28T12:00:00Z",
  "total_sites": 11,
  "total_pages_checked": 1543,
  "total_errors_404": 12,
  "sites_results": [
    { "site": "marseille", "total_checked": 145, "errors_404": 2 },
    { "site": "toulouse", "total_checked": 138, "errors_404": 1 }
  ],
  "crawl_duration_seconds": 45
}
```

#### 3. `sites`

**Description** : Référentiel des 11 sites

**Schéma** :
```sql
id STRING
city STRING
domain STRING
status STRING
created_at TIMESTAMP
updated_at TIMESTAMP
```

**Données** :
```
marseille  | devis-demenageur-marseille.fr
toulouse   | demenageur-toulousain.fr
lyon       | devis-demenageur-lyon.fr
...
```

---

## 🌐 DASHBOARD

### Structure

**Framework** : Next.js 14 (App Router)  
**Langage** : TypeScript  
**Styling** : Tailwind CSS  
**Charts** : Recharts  
**Build** : Mode standalone (optimisé Docker)

### API Routes

#### GET `/api/metrics/global`

**Description** : KPIs globaux par site

**Query params** :
- `days` (number) : Période (défaut: 7)

**Response** :
```json
{
  "success": true,
  "data": [
    {
      "site": "marseille",
      "clicks": 315,
      "impressions": 8634,
      "ctr": 0.036,
      "position": 8.2,
      "trend_clicks": 12.5,
      "trend_impressions": 8.3
    }
  ],
  "meta": { "days": 7, "count": 11 }
}
```

**Code** : `dashboard/lib/bigquery.ts : getGlobalMetrics()`

---

#### GET `/api/metrics/timeseries`

**Description** : Évolution temporelle

**Query params** :
- `site` (string, optionnel) : Filtrer par site
- `days` (number) : Période (défaut: 30)

**Response** :
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-10-28",
      "site": "marseille",
      "clicks": 45,
      "impressions": 1234,
      "ctr": 0.036,
      "position": 8.2
    }
  ]
}
```

**Code** : `dashboard/lib/bigquery.ts : getTimeSeriesData()`

---

#### POST `/api/etl/run`

**Description** : Lancer l'ETL manuellement

**Response** :
```json
{
  "success": true,
  "message": "ETL lancé avec succès",
  "timestamp": "2025-10-28T12:00:00Z"
}
```

**Code** : `dashboard/app/api/etl/run/route.ts`

**Note** : Exécute `npx tsx etl/gsc/fetch-simple.ts` via `execAsync()`

---

#### GET `/api/vitals`

**Description** : Santé des sites (déploiements, derniers commits)

**Source** : GitHub API + déploiements

**Response** :
```json
{
  "success": true,
  "data": [
    {
      "repo": "moverz_marseille",
      "lastDeploy": "2025-10-27T10:00:00Z",
      "lastCommit": "2025-10-27T09:30:00Z",
      "status": "healthy"
    }
  ]
}
```

**Code** : `dashboard/app/api/vitals/route.ts`

---

#### GET `/api/404/history`

**Description** : Historique des scans 404

**Query params** :
- `days` (number) : Période (défaut: 30)

**Response** :
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-10-28",
      "nb_scans": 1,
      "avg_pages_checked": 1543,
      "avg_errors_404": 12,
      "max_errors_404": 15,
      "min_errors_404": 8,
      "avg_duration_seconds": 45
    }
  ]
}
```

**Code** : `dashboard/lib/bigquery.ts : getError404Evolution()`

---

#### POST `/api/404/scan`

**Description** : Lancer un scan d'erreurs 404

**Response** :
```json
{
  "success": true,
  "scanId": "scan-20251028-123456",
  "totalErrors": 12,
  "duration": 45
}
```

**Code** : `dashboard/app/api/404/scan/route.ts`

---

### Pages

#### `/` - Vue Globale

**Composants** :
- `MetricCard` : Affiche KPI (clicks, impressions, CTR, position)
- `TimeSeriesChart` : Graphique évolution
- `GroupedDataTable` : Tableau comparatif sites
- `PeriodSelector` : Sélecteur période (7/30/90 jours)

**Data** :
- `GET /api/metrics/global?days=7`
- `GET /api/metrics/timeseries?days=30`

---

#### `/vitals` - Monitoring Santé

**Data** : `GET /api/vitals`

Affiche :
- Dernier déploiement
- Dernier commit GitHub
- Statut (healthy/degraded/error)

---

#### `/404` - Erreurs 404

**Composants** :
- `Error404Evolution` : Graphique évolution
- Tableau détaillé par scan

**Data** :
- `GET /api/404/history?days=30`

---

## 🤖 AGENTS IA

### Architecture

**Orchestrateur** : `agents/core/orchestrator.ts`

**Agents disponibles** :
1. SEO Optimizer (`agents/seo-optimizer/agent.ts`) ✅
2. Content Strategist (structure prête)
3. CRO Optimizer (structure prête)
4. Report Generator (structure prête)
5. Alerts Manager (structure prête)

### SEO Optimizer

**Rôle** : Détecter opportunités et problèmes SEO

**Source de données** :
```typescript
import { 
  getLowCTRPages,      // Pages avec CTR < 2%
  getVisibilityTrends, // Chutes de visibilité
  getTopQueries        // Top requêtes
} from '../shared/bigquery-tools'
```

**Analyse IA** :
```typescript
const result = await chatWithJSON(SYSTEM_PROMPT, userMessage, {
  model: 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 3000,
})
```

**Output** :
```json
{
  "actions": [
    {
      "priority": "high",
      "site": "marseille",
      "title": "Optimiser title page prix déménagement",
      "description": "Ajouter '2025' et 'gratuit'",
      "estimatedImpact": "+150 clics/mois",
      "estimatedEffort": "Faible",
      "category": "title-optimization"
    }
  ],
  "summary": "5 opportunités SEO identifiées..."
}
```

**Fréquence** : Quotidien (12:00)  
**Coût estimé** : ~$3/mois

---

## 🔐 VARIABLES D'ENVIRONNEMENT

### Obligatoires (Production)

```bash
# BigQuery
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GCP_SA_KEY_JSON={"type":"service_account",...}

# Sites
SITES_LIST=devis-demenageur-marseille.fr,devis-demenageur-toulouse.fr,...

# ETL
FETCH_DAYS=3
TIMEZONE=Europe/Paris
```

### Optionnelles

```bash
# App Mode (CapRover)
APP_MODE=dashboard  # ou: etl, dev

# OpenAI (Agents IA)
OPENAI_API_KEY=sk-...

# Notifications
SLACK_WEBHOOK_URL=https://...

# PostgreSQL (Leads)
DATABASE_URL=postgresql://...
```

---

## 🚀 DÉPLOIEMENT

### CapRover

**Configuration** :
```json
{
  "schemaVersion": 2,
  "dockerfilePath": "./Dockerfile"
}
```

**Variables d'env CapRover** :
```bash
APP_MODE=dashboard
GCP_SA_KEY_JSON={...}
SITES_LIST=...
```

**Build** : ~3-5 min (optimisé standalone)

**Healthcheck** :
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "console.log('healthy')" || exit 1
```

### Local

```bash
# Dashboard
cd dashboard
npm install
npm run dev  # http://localhost:3000

# ETL
npm run etl:gsc

# Agents
npm run agents:run
```

---

## 📈 MÉTRIQUES SUIVIES

### SEO (GSC)

| Métrique | Source | Table | Calcul |
|----------|--------|-------|--------|
| Impressions | GSC API | `gsc_daily_aggregated` | SUM(impressions) |
| Clics | GSC API | `gsc_daily_aggregated` | SUM(clicks) |
| CTR | GSC API | `gsc_daily_aggregated` | AVG(ctr) |
| Position | GSC API | `gsc_daily_aggregated` | AVG(position) |
| Trend | Calculé | - | (current - previous) / previous * 100 |

### Évolution Temporelle

**Query** : `dashboard/lib/bigquery.ts : getTimeSeriesData()`

```sql
SELECT 
  date,
  domain,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  AVG(ctr) as ctr,
  AVG(position) as position
FROM analytics_core.gsc_daily_aggregated
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY date, domain
ORDER BY date DESC
```

---

## 🎯 RÉSUMÉ DES FICHIERS CLÉS

### ETL
- `etl/gsc/fetch-simple.ts` → ETL GSC (quotidien 09h)
- `etl/scheduler.ts` → Orchestrateur cron
- `etl/shared/bigquery-client.ts` → Wrapper BigQuery

### Dashboard
- `dashboard/lib/bigquery.ts` → Queries BigQuery
- `dashboard/app/page.tsx` → Vue globale
- `dashboard/app/api/metrics/global/route.ts` → API KPIs

### Agents
- `agents/core/orchestrator.ts` → Chef d'orchestre
- `agents/seo-optimizer/agent.ts` → Agent SEO
- `agents/shared/bigquery-tools.ts` → Helpers queries

### Database
- `db/migrations/001_initial.sql` → Tables initiales
- `db/migrations/003_gsc_daily_aggregated.sql` → Table GSC V2
- `db/migrations/004_errors_404_history.sql` → Table 404

---

## 📚 DOCUMENTATION PAR SUJET

### Pour comprendre les données
→ Voir section "SOURCES DE DONNÉES"

### Pour comprendre les ETL
→ Voir section "FLUX DE DONNÉES"

### Pour comprendre le Dashboard
→ Voir section "DASHBOARD" + fichiers dans `dashboard/app/`

### Pour comprendre les Agents IA
→ Voir section "AGENTS IA" + `agents/README.md`

### Pour déployer
→ `CAPROVER-DEPLOY.md` + `Dockerfile`

### Pour développer
→ `GETTING-STARTED.md` + `README.md`

---

**Dernière mise à jour** : 30 Octobre 2025  
**Version** : 1.0.0  
**Mainteneur** : Guillaume Stehelin (guillaume@moverz.io)

