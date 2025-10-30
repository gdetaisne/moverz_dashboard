# 📊 Index des Sources de Données

**Version** : 1.0.0  
**Dernière mise à jour** : 30 Octobre 2025

---

## 🎯 Vue Rapide : D'où vient chaque donnée ?

### Tableau de Correspondance

| Donnée | Source Originale | ETL | Table BigQuery | API Dashboard | Page Dashboard |
|--------|-----------------|-----|----------------|---------------|----------------|
| **Impressions / Clics / CTR / Position** | Google Search Console API | `etl/gsc/fetch-simple.ts` | `gsc_daily_aggregated` | `/api/metrics/global` | `/` (vue globale) |
| **Évolution temporelle SEO** | Google Search Console API | `etl/gsc/fetch-simple.ts` | `gsc_daily_aggregated` | `/api/metrics/timeseries` | `/` (graphique) |
| **Erreurs 404** | Crawl direct sites | `dashboard/app/api/404/scan/route.ts` | `errors_404_history` | `/api/404/history` | `/404` |
| **Santé des sites (déploiements)** | GitHub API | `dashboard/app/api/vitals/route.ts` | N/A (calculé) | `/api/vitals` | `/vitals` |

---

## 📍 Sources Détaillées

### 1. 🟢 SEO Data (Google Search Console)

**Emplacement** : `analytics_core.gsc_daily_aggregated`

**Chemin complet** :
```
Google Search Console API
    ↓ (09h00 quotidien via etl/scheduler.ts)
etl/gsc/fetch-simple.ts
    ↓ (fetchGSCData() + upsertToBigQuery())
BigQuery: analytics_core.gsc_daily_aggregated
    ↓ (Query SQL)
dashboard/lib/bigquery.ts : getGlobalMetrics()
    ↓ (API Route)
dashboard/app/api/metrics/global/route.ts
    ↓ (Fetch frontend)
dashboard/app/page.tsx : fetchData()
    ↓ (Affichage)
MetricCard components
```

**Fichiers impliqués** :
- `etl/gsc/fetch-simple.ts` (extraction)
- `etl/shared/bigquery-client.ts` (insertion)
- `dashboard/lib/bigquery.ts` (requêtes)
- `dashboard/app/api/metrics/global/route.ts` (API)
- `dashboard/app/page.tsx` (affichage)

**Champs disponibles** :
```typescript
{
  date: string
  domain: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}
```

---

### 2. 🔴 Erreurs 404

**Emplacement** : `analytics_core.errors_404_history`

**Chemin complet** :
```
Crawl direct (fetch HTML)
    ↓ (Manuel via /api/404/scan)
dashboard/app/api/404/scan/route.ts
    ↓ (insertError404History())
BigQuery: analytics_core.errors_404_history
    ↓ (Query SQL)
dashboard/lib/bigquery.ts : getError404Evolution()
    ↓ (API Route)
dashboard/app/api/404/history/route.ts
    ↓ (Fetch frontend)
dashboard/app/404/page.tsx
    ↓ (Affichage)
Error404Evolution component
```

**Fichiers impliqués** :
- `dashboard/app/api/404/scan/route.ts` (scan)
- `dashboard/lib/bigquery.ts` : `insertError404History()` (insertion)
- `dashboard/lib/bigquery.ts` : `getError404Evolution()` (requête)
- `dashboard/app/api/404/history/route.ts` (API)
- `dashboard/app/404/page.tsx` (affichage)

**Champs disponibles** :
```typescript
{
  id: string
  scan_date: string
  total_sites: number
  total_pages_checked: number
  total_errors_404: number
  sites_results: Array<{site, total_checked, errors_404}>
  crawl_duration_seconds: number
}
```

---

### 3. 🔵 Santé Sites (Web Vitals)

**Emplacement** : En mémoire (calculé à la volée)

**Chemin complet** :
```
GitHub API + CapRover
    ↓ (GET sur /api/vitals)
dashboard/app/api/vitals/route.ts
    ↓ (getLastCommit() + fetch CapRover)
Response JSON
    ↓ (Fetch frontend)
dashboard/app/vitals/page.tsx
    ↓ (Affichage)
Tableau sites
```

**Fichiers impliqués** :
- `dashboard/app/api/vitals/route.ts` (logique)
- `dashboard/app/vitals/page.tsx` (affichage)

**Champs disponibles** :
```typescript
{
  repo: string
  lastDeploy: string
  lastCommit: string
  status: 'healthy' | 'degraded' | 'error'
}
```

---

## 🔍 Requêtes SQL Principales

### KPIs Globaux (7 jours)

**Fichier** : `dashboard/lib/bigquery.ts : getGlobalMetrics()`

```sql
WITH current_period AS (
  SELECT 
    domain as site,
    SUM(clicks) as clicks,
    SUM(impressions) as impressions,
    AVG(ctr) as ctr,
    AVG(position) as position
  FROM `analytics_core.gsc_daily_aggregated`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  GROUP BY domain
),
previous_period AS (
  SELECT 
    domain as site,
    SUM(clicks) as prev_clicks,
    SUM(impressions) as prev_impressions
  FROM `analytics_core.gsc_daily_aggregated`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
    AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  GROUP BY domain
)
SELECT 
  c.*,
  SAFE_DIVIDE(c.clicks - COALESCE(p.prev_clicks, 0), COALESCE(p.prev_clicks, 1)) * 100 as trend_clicks
FROM current_period c
LEFT JOIN previous_period p ON c.site = p.site
```

---

### Évolution Temporelle (30 jours)

**Fichier** : `dashboard/lib/bigquery.ts : getTimeSeriesData()`

```sql
SELECT 
  FORMAT_DATE('%Y-%m-%d', date) as date,
  domain as site,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  AVG(ctr) as ctr,
  AVG(position) as position
FROM `analytics_core.gsc_daily_aggregated`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY date, domain
ORDER BY date DESC, domain
```

---

### Historique Erreurs 404

**Fichier** : `dashboard/lib/bigquery.ts : getError404Evolution()`

```sql
SELECT 
  DATE(scan_date) as date,
  COUNT(*) as nb_scans,
  AVG(total_pages_checked) as avg_pages_checked,
  AVG(total_errors_404) as avg_errors_404,
  MAX(total_errors_404) as max_errors_404,
  MIN(total_errors_404) as min_errors_404,
  AVG(crawl_duration_seconds) as avg_duration_seconds
FROM `analytics_core.errors_404_history`
WHERE scan_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY DATE(scan_date)
ORDER BY date DESC
```

---

## 🗺️ Cartographie Complète

### Structure des Fichiers par Flux

```
📁 Sources de Données
├─ 🌐 Google Search Console API
│  ├─ etl/gsc/fetch-simple.ts (extraction)
│  ├─ etl/shared/bigquery-client.ts (insertion)
│  └─ BigQuery: analytics_core.gsc_daily_aggregated
│
├─ 🐛 Crawl Sites (404)
│  ├─ dashboard/app/api/404/scan/route.ts (scan)
│  └─ BigQuery: analytics_core.errors_404_history
│
├─ 🟢 GitHub API (déploiements)
│  └─ dashboard/app/api/vitals/route.ts (calculé)
│
└─ 📊 BigQuery (requêtes)
   ├─ dashboard/lib/bigquery.ts (helpers)
   ├─ dashboard/app/api/metrics/global/route.ts
   ├─ dashboard/app/api/metrics/timeseries/route.ts
   ├─ dashboard/app/api/404/history/route.ts
   └─ dashboard/app/api/vitals/route.ts
```

---

## 🔄 Flux Réel d'Exemple

### Exemple : Afficher les KPIs Globaux

**1. ETL (background, quotidien 09h00)**
```bash
# Créé via cron CapRover
npx tsx etl/gsc/fetch-simple.ts
```

**2. Extraction**
```typescript
// etl/gsc/fetch-simple.ts : line 324
const gscRows = await fetchGSCData(domain, startDate, endDate)
// → [{ keys: ['2025-10-28'], clicks: 45, ... }]
```

**3. Transformation**
```typescript
// etl/gsc/fetch-simple.ts : line 327
const bqRows = transformRows(domain, gscRows)
// → [{ date: '2025-10-28', domain: 'marseille', clicks: 45, ... }]
```

**4. Insertion BigQuery**
```typescript
// etl/gsc/fetch-simple.ts : line 330
await upsertToBigQuery(bqRows)
// → MERGE INTO analytics_core.gsc_daily_aggregated
```

**5. Requête Dashboard**
```typescript
// dashboard/app/page.tsx : line 23
fetch('/api/metrics/global?days=7')
```

**6. API Route**
```typescript
// dashboard/app/api/metrics/global/route.ts : line 7
const data = await getGlobalMetrics(days)
```

**7. Query SQL**
```typescript
// dashboard/lib/bigquery.ts : line 50
await bigquery.query({ query }) // → KPIs globaux
```

**8. Affichage**
```typescript
// dashboard/app/page.tsx : line 30
setGlobalData(globalJson.data)
// → Rend MetricCard components
```

---

## 📝 Notes Importantes

### Fréquence des Mises à Jour

| Source | Fréquence | Heure | Fichier |
|--------|-----------|-------|---------|
| GSC | Quotidien | 09:00 | `etl/scheduler.ts` |
| 404 | Manuel | N/A | `/api/404/scan` |
| Vitals | Calculé | À chaque requête | `/api/vitals` |

### Latence

- **GSC** : 48-72h de latence (données J-1 disponibles à J+3)
- **404** : Temps réel (scan direct)
- **Vitals** : Temps réel (calculé)

### Dépendances

- **GSC →** Nécessite Service Account configuré
- **404 →** Nécessite accès internet (crawl)
- **Vitals →** Nécessite GitHub API + CapRover

---

**🎯 À retenir** : Toutes les données passent par BigQuery sauf Vitals (calculé à la volée).

