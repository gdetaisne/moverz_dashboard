# 🔄 Migration Guide - Ancienne Config → Nouvelle Architecture

Guide pour migrer d'une config existante vers la nouvelle architecture moverz_dashboard.

---

## 📊 Avant / Après

### Configuration Actuelle (CapRover)

```bash
# Ancien setup
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
BQ_TABLE_NAME=gsc_daily_metrics
GCP_SA_KEY=----BEGIN PRIVATE KEY-----\n...
GOOGLE_APPLICATION_CREDENTIALS=/app/sa-key.json
SITES_LIST=devis-demenageur-marseille.fr,...
```

### Nouvelle Architecture

```bash
# Nouveau setup (compatible)
GCP_PROJECT_ID=moverz-dashboard  ✅ Inchangé
BQ_DATASET=analytics_core        ✅ Inchangé
GOOGLE_APPLICATION_CREDENTIALS=/app/sa-key.json  ✅ Inchangé
SITES_LIST=...                   ✅ Inchangé

# Nouvelles variables (optionnelles)
FETCH_DAYS=3
TIMEZONE=Europe/Paris
NODE_ENV=production
```

**✅ Aucune variable à changer !**  
**La nouvelle architecture est 100% compatible.**

---

## 🎯 Ce Qui Change

### 1. Structure de Code

**Avant** : Scripts isolés  
**Après** : Architecture modulaire complète

```
Nouveau:
├── etl/
│   ├── gsc/fetch.ts          ← ETL Google Search Console
│   ├── leads/sync.ts         ← ETL Leads
│   ├── scheduler.ts          ← Orchestrateur
│   └── shared/               ← Utilitaires partagés
├── agents/
│   └── seo-optimizer/        ← Agent IA SEO
├── scripts/
│   ├── setup/                ← Scripts setup automatisés
│   └── test/                 ← Tests validation
└── db/
    └── migrations/           ← Migrations BigQuery
```

### 2. Tables BigQuery

**Avant** : Table unique `gsc_daily_metrics`  
**Après** : 8 tables spécialisées

```sql
-- Nouvelles tables (migrations automatiques)
analytics_core.sites              -- Référentiel 11 sites
analytics_core.gsc_global         -- Métriques quotidiennes
analytics_core.gsc_pages          -- Performance par page
analytics_core.gsc_queries        -- Performance par requête
analytics_core.leads              -- Conversions
analytics_core.web_vitals         -- Performance
analytics_core.alerts             -- Alertes
analytics_core.etl_jobs_log       -- Monitoring ETL
```

**⚠️ La table `gsc_daily_metrics` existante n'est PAS supprimée.**

### 3. ETL

**Avant** : Script custom  
**Après** : Scheduler avec 3 jobs quotidiens

```javascript
// Nouveau scheduler
09:00 → ETL GSC (Google Search Console)
10:00 → ETL Leads (PostgreSQL → BigQuery)
11:00 → Web Vitals Aggregation
```

---

## 📋 Plan de Migration

### Option A : Migration Progressive (Recommandé ✅)

**Garder l'ancien code actif, tester le nouveau en parallèle**

1. **Deploy nouveau code** (CapRover)
   ```bash
   git push caprover main
   ```

2. **Tester ETL manuellement**
   ```bash
   npm run etl:gsc  # Test GSC ETL
   ```

3. **Vérifier nouvelles tables**
   ```sql
   SELECT * FROM analytics_core.gsc_global LIMIT 10
   ```

4. **Comparer avec ancienne table**
   ```sql
   -- Ancien
   SELECT SUM(impressions) FROM analytics_core.gsc_daily_metrics
   WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
   
   -- Nouveau
   SELECT SUM(impressions) FROM analytics_core.gsc_global
   WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
   ```

5. **Si OK** → Activer scheduler
   ```bash
   # Dans CapRover, changer CMD:
   CMD ["npm", "run", "dev"]  # Lance le scheduler
   ```

6. **Migration complète après 1 semaine de tests**

### Option B : Migration Immédiate

**Remplacer complètement l'ancien code**

```bash
# 1. Backup ancien code
git tag backup-old-config

# 2. Deploy nouveau code
git push caprover main

# 3. Appliquer migrations BigQuery
npm run db:migrate

# 4. Lancer scheduler
# (redémarrage automatique CapRover)
```

---

## 🧪 Tests de Validation

### 1. Vérifier Config

```bash
# Lancer en mode debug
DEBUG=true npm run etl:gsc

# Output attendu:
# 📝 Configuration:
#   GCP_PROJECT_ID: moverz-dashboard
#   BQ_DATASET: analytics_core
#   SITES: 11 sites
```

### 2. Tester ETL GSC

```bash
npm run etl:gsc

# Output attendu:
# 🔍 Starting GSC ETL...
# Processing devis-demenageur-marseille.fr...
# ✅ marseille: 300 rows
# ...
# ✅ ETL completed: success
```

### 3. Vérifier Données BigQuery

```sql
-- Nouvelles tables créées ?
SELECT table_name 
FROM `moverz-dashboard.analytics_core.INFORMATION_SCHEMA.TABLES`
WHERE table_name IN ('gsc_global', 'gsc_pages', 'gsc_queries')

-- Données insérées ?
SELECT 
  site,
  COUNT(*) as days,
  SUM(impressions) as total_impressions
FROM `moverz-dashboard.analytics_core.gsc_global`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY site
```

### 4. Comparer Ancien vs Nouveau

```sql
-- Script de comparaison
WITH old_data AS (
  SELECT 
    site,
    SUM(impressions) as impressions,
    SUM(clicks) as clicks
  FROM `moverz-dashboard.analytics_core.gsc_daily_metrics`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  GROUP BY site
),
new_data AS (
  SELECT 
    site,
    SUM(impressions) as impressions,
    SUM(clicks) as clicks
  FROM `moverz-dashboard.analytics_core.gsc_global`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  GROUP BY site
)
SELECT 
  COALESCE(old_data.site, new_data.site) as site,
  old_data.impressions as old_impressions,
  new_data.impressions as new_impressions,
  new_data.impressions - old_data.impressions as diff
FROM old_data
FULL OUTER JOIN new_data ON old_data.site = new_data.site
ORDER BY site
```

---

## 🔄 Rollback (si problème)

### Rollback immédiat

```bash
# Via CapRover UI
Apps → dd-dashboard → Deployment → Previous Builds
→ Sélectionner "backup-old-config" → Deploy
```

### Rollback Git

```bash
git revert HEAD~3..HEAD
git push caprover main
```

---

## 📊 Checklist Migration

### Phase 1 : Préparation
- [ ] Backup code actuel (`git tag backup-old-config`)
- [ ] Lire CAPROVER-DEPLOY.md
- [ ] Vérifier variables d'env CapRover
- [ ] Noter ancien CMD Docker

### Phase 2 : Tests Local
- [ ] Clone repo `moverz_dashboard`
- [ ] `npm install`
- [ ] Configurer `.env` local
- [ ] Tester `npm run etl:gsc` (local)
- [ ] Vérifier données BigQuery

### Phase 3 : Deploy CapRover
- [ ] Push vers CapRover (`git push caprover main`)
- [ ] Attendre rebuild (~5-10 min)
- [ ] Vérifier logs CapRover
- [ ] Tester ETL manuellement
- [ ] Comparer données ancien vs nouveau

### Phase 4 : Activation Scheduler
- [ ] Changer CMD Docker → `npm run dev`
- [ ] Rebuild CapRover
- [ ] Vérifier cron jobs (09:00, 10:00, 11:00)
- [ ] Monitoring logs quotidien

### Phase 5 : Validation (1 semaine)
- [ ] ETL tourne quotidiennement sans erreur
- [ ] Données cohérentes avec ancien système
- [ ] Aucune alerte
- [ ] Migration complète validée ✅

---

## 🆘 Support

**Problème ?**
- Consulter `CAPROVER-DEPLOY.md` section Troubleshooting
- Consulter `STATUS.md` pour l'inventaire complet
- Vérifier logs : `caprover logs -a dd-dashboard -f`

**Questions ?**
- Email : guillaume@moverz.io
- GitHub Issues : [moverz_dashboard/issues](https://github.com/gdetaisne/moverz_dashboard/issues)

---

**✅ Migration 100% compatible**  
**⏱️ Temps estimé : 1-2 heures**  
**🔄 Rollback possible à tout moment**

