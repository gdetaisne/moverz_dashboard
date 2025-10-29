# 🗄️ Database - Schéma BigQuery

Gestion du schéma BigQuery et des migrations.

## 📁 Structure

```
db/
├── migrations/          # Migrations versionnées
│   ├── 001_initial.sql
│   ├── 002_gsc_tables.sql
│   ├── 003_ga4_tables.sql
│   └── 004_leads_tables.sql
├── schema/              # Schémas actuels (référence)
│   ├── gsc.sql
│   ├── ga4.sql
│   ├── leads.sql
│   └── web_vitals.sql
├── queries/             # Requêtes réutilisables
│   ├── kpis.sql
│   └── alerts.sql
└── seed_sites.ts        # Données initiales (11 sites)
```

## 🚀 Usage

### Appliquer les migrations

```bash
# Créer les tables BigQuery
npm run db:migrate
```

### Seed initial

```bash
# Insérer les 11 sites
npm run db:seed
```

## 📊 Tables

### 1. `sites` (référentiel)
```sql
id, city, domain, status, created_at
```

### 2. `gsc_global` (métriques quotidiennes)
```sql
site, date, impressions, clicks, ctr, position
```

### 3. `gsc_pages` (performance par page)
```sql
site, date, url, impressions, clicks, ctr, position
```

### 4. `gsc_queries` (performance par requête)
```sql
site, date, query, impressions, clicks, ctr, position
```

### 5. `ga4_events` (export GA4 natif)
```sql
event_date, event_name, user_pseudo_id, device, city, ...
```

### 6. `leads` (conversions)
```sql
id, created_at, site, source, medium, status, ...
```

### 7. `web_vitals` (métriques performance)
```sql
site, date, url, device, metric, p50, p75, p95
```

## 🔄 Workflow de migration

### 1. Créer une migration

```bash
# Créer db/migrations/005_nouvelle_table.sql
CREATE TABLE IF NOT EXISTS moverz.nouvelle_table (
  id STRING,
  created_at TIMESTAMP
);
```

### 2. Appliquer

```bash
npm run db:migrate
```

### 3. Documenter

Mettre à jour `/docs/guides/schema.md`

## 📈 Requêtes utiles

### KPIs globaux (30 derniers jours)

```sql
-- Voir queries/kpis.sql
SELECT 
  site,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  AVG(ctr) as avg_ctr,
  AVG(position) as avg_position
FROM moverz.gsc_global
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY site
ORDER BY total_clicks DESC
```

### Top pages (7 derniers jours)

```sql
SELECT 
  site,
  url,
  SUM(clicks) as total_clicks
FROM moverz.gsc_pages
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY site, url
ORDER BY total_clicks DESC
LIMIT 20
```

## 🔐 Permissions BigQuery

Le service account doit avoir :
- `BigQuery Data Editor`
- `BigQuery Job User`

---

**Documentation complète** : `/docs/guides/setup-bigquery.md`

