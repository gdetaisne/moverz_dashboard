# 🔄 ETL Usage Guide - Google Search Console → BigQuery

Guide complet pour utiliser l'ETL V1 (table unique `gsc_daily_metrics`).

---

## 📋 Table des Matières

1. [Usage Quotidien](#-usage-quotidien)
2. [Ajouter un Domaine](#-ajouter-un-domaine)
3. [Backfill (Remplissage Historique)](#-backfill-remplissage-historique)
4. [Migration Multi-Tables (V2)](#-migration-multi-tables-v2)
5. [Troubleshooting](#-troubleshooting)

---

## 🚀 Usage Quotidien

### **Lancement Manuel (Local)**

```bash
# Prérequis: fichier .env configuré
npm install

# Lancer l'ETL une fois
npm run run:once

# Résultat attendu:
# ✅ 11 domaines traités
# ✅ Milliers de lignes insérées dans BigQuery
# ✅ Code sortie: 0 (succès)
```

### **Codes de Sortie**

| Code | Signification | Action |
|------|---------------|--------|
| `0` | ✅ Succès complet | RAS |
| `1` | ❌ Échec complet (auth, BQ indispo) | Vérifier credentials |
| `2` | ⚠️ Succès partiel (≥1 domaine en erreur) | Vérifier logs |

### **Cron CapRover (Production)**

**Configuration recommandée :**
```bash
# Cron: 15 3 * * *  (03:15 Europe/Paris)
# CMD: npm run run:once

# CapRover UI:
Apps → dd-dashboard → App Configs → Persistent Apps
→ Ajouter Cron Job:
   Schedule: 15 3 * * *
   Command: npm run run:once
```

**Pourquoi 03:15 ?**
- GSC a ~48-72h de latence
- Fenêtre glissante `FETCH_DAYS=3` rattrape le retard
- Heure creuse (peu de charge serveur)

---

## ➕ Ajouter un Domaine

### **Étape 1 : Autoriser le Service Account dans GSC**

1. **Aller dans Google Search Console**  
   → https://search.google.com/search-console

2. **Sélectionner la propriété** (ex: `devis-demenageur-dijon.fr`)

3. **Paramètres → Utilisateurs et autorisations**

4. **Ajouter un utilisateur :**
   - Email : `<votre-sa>@<project>.iam.gserviceaccount.com`
   - Permission : **Propriétaire** (requis pour API)

5. **Valider**

### **Étape 2 : Ajouter le Domaine à `SITES_LIST`**

**Via CapRover UI :**
```bash
# Apps → dd-dashboard → App Configs → Environment Variables
SITES_LIST=devis-demenageur-marseille.fr,...,devis-demenageur-dijon.fr
```

**Ou via `.env` (local) :**
```bash
SITES_LIST=devis-demenageur-marseille.fr,devis-demenageur-toulousain.fr,devis-demenageur-lyon.fr,bordeaux-demenageur.fr,devis-demenageur-nantes.fr,devis-demenageur-lille.fr,devis-demenageur-nice.fr,devis-demenageur-strasbourg.fr,devis-demenageur-rouen.fr,devis-demenageur-rennes.fr,devis-demenageur-montpellier.fr,devis-demenageur-dijon.fr
```

### **Étape 3 : Tester**

```bash
# Lancer manuellement
npm run run:once

# Vérifier logs
# Attendu: "Processing devis-demenageur-dijon.fr... ✅"

# Vérifier BigQuery
SELECT domain, COUNT(*) as rows
FROM `moverz-dashboard.analytics_core.gsc_daily_metrics`
WHERE domain = 'devis-demenageur-dijon.fr'
GROUP BY domain
```

**✅ C'est tout !** Le nouveau domaine sera inclus dans les prochains runs.

---

## 🔄 Backfill (Remplissage Historique)

### **Cas d'Usage**

- Nouveau domaine : remplir les 16 derniers mois (limite GSC)
- Échec ETL : re-remplir une période manquante
- Migration : synchroniser l'historique complet

### **Usage Basique**

```bash
# Backfill 30 derniers jours (tous les domaines)
npm run backfill -- --start 2024-12-01 --end 2024-12-31

# Backfill 1 domaine spécifique
npm run backfill -- \
  --start 2024-12-01 \
  --end 2024-12-31 \
  --domain devis-demenageur-marseille.fr

# Backfill 16 mois complets (limite GSC)
npm run backfill -- \
  --start 2023-09-01 \
  --end 2024-12-31 \
  --batch-size 7
```

### **Options**

| Option | Description | Défaut |
|--------|-------------|--------|
| `--start` | Date de début (YYYY-MM-DD) | J-30 |
| `--end` | Date de fin (YYYY-MM-DD) | Aujourd'hui |
| `--domain` | Domaine spécifique (optionnel) | Tous (SITES_LIST) |
| `--batch-size` | Taille du batch en jours | 7 |

### **Limites GSC**

⚠️ **Google Search Console ne conserve que 16 mois d'historique.**

Si tu demandes `--start 2022-01-01`, le script ajustera automatiquement à `J-16 mois`.

### **Performance**

**Batch Size :**
- `--batch-size 7` (défaut) : 7 jours par requête → 60 requêtes pour 1 an
- `--batch-size 30` : 30 jours par requête → 12 requêtes pour 1 an (plus rapide, mais risque timeout)

**Rate Limiting :**
- Pause de 2s entre chaque batch
- Exponential backoff sur HTTP 429

**Durée estimée :**
- 1 domaine, 30 jours : ~5 min
- 11 domaines, 16 mois : ~2-3h

### **Idempotence**

✅ **Relancer un backfill n'insère PAS de doublons.**

Le MERGE upsert sur `(date, domain, page, query)` garantit l'idempotence.

---

## 🔄 Migration Multi-Tables (V2)

### **Pourquoi Migrer ?**

**V1 (Table Unique)** :
```sql
gsc_daily_metrics
├── date, domain, page, query
└── clicks, impressions, ctr, position
```

**V2 (3 Tables Séparées)** :
```sql
gsc_global   → Métriques quotidiennes globales
gsc_pages    → Métriques par page
gsc_queries  → Métriques par requête
```

**Avantages V2 :**
- ✅ **Tables plus petites** : Clustering + partitioning optimaux
- ✅ **Queries plus rapides** : Pas de `GROUP BY` coûteux
- ✅ **Séparation des concerns** : Global ≠ Pages ≠ Queries
- ✅ **Extensible** : Facilite l'ajout de dimensions (device, country)

**Quand migrer ?**
- Table `gsc_daily_metrics` > 10M lignes
- Queries lentes (>10s)
- Besoin d'ajouter des dimensions

### **Migration Automatisée**

```bash
# Étape 1 : Dry-run (simulation)
npm run split-tables -- --dry-run

# Output attendu:
# [DRY-RUN] Would create table: gsc_global
# [DRY-RUN] Estimated rows to migrate: 2,345,678

# Étape 2 : Migration réelle (DESTRUCTIVE)
npm run split-tables -- --confirm

# Output attendu:
# ✅ Created table: gsc_global (1,234,567 rows)
# ✅ Created table: gsc_pages (8,765,432 rows)
# ✅ Created table: gsc_queries (9,876,543 rows)
# ✅ Validation OK: totals match
# ✅ Backup created: gsc_daily_metrics_backup
```

### **Ce Que Fait le Script**

1. **Créer nouvelles tables** (`gsc_global`, `gsc_pages`, `gsc_queries`)
2. **Migrer données** (INSERT INTO ... SELECT ... FROM `gsc_daily_metrics`)
3. **Valider totaux** (comparer clicks/impressions)
4. **Backup table originale** (`gsc_daily_metrics_backup`)

### **Rollback (si problème)**

```sql
-- Supprimer nouvelles tables
DROP TABLE `moverz-dashboard.analytics_core.gsc_global`;
DROP TABLE `moverz-dashboard.analytics_core.gsc_pages`;
DROP TABLE `moverz-dashboard.analytics_core.gsc_queries`;

-- Restaurer backup (si nécessaire)
CREATE TABLE `moverz-dashboard.analytics_core.gsc_daily_metrics`
AS SELECT * FROM `moverz-dashboard.analytics_core.gsc_daily_metrics_backup`;
```

### **Après Migration**

**Mettre à jour ETL :**
```bash
# Passer de fetch-simple.ts à fetch.ts (multi-tables)
# Dans CapRover CMD:
npm run etl:gsc  # (au lieu de npm run run:once)
```

**Mettre à jour Dashboard :**
```sql
-- Anciennes queries (V1)
SELECT domain, SUM(clicks), SUM(impressions)
FROM `gsc_daily_metrics`
GROUP BY domain

-- Nouvelles queries (V2)
SELECT site, clicks, impressions
FROM `gsc_global`
```

---

## 🔧 Troubleshooting

### **Erreur : "GCP_SA_KEY_JSON is required"**

**Solution :**
```bash
# Vérifier variable d'env
echo $GCP_SA_KEY_JSON

# Si vide, configurer dans CapRover UI:
Apps → dd-dashboard → App Configs → Environment Variables
→ GCP_SA_KEY_JSON={"type":"service_account",...}
```

### **Erreur : "Permission denied (Search Console)"**

**Solution :**
1. Vérifier que le Service Account est bien **Propriétaire** dans GSC
2. Attendre 5-10 min (propagation IAM)
3. Relancer ETL

### **Erreur : "Rate limited (HTTP 429)"**

**Solution :**
- Le script gère automatiquement (exponential backoff)
- Si persiste : réduire `--batch-size` dans backfill

### **Données manquantes (impressions = 0)**

**Causes :**
- GSC a ~48-72h de latence → Normal pour J-1 / J-2
- Nouveau domaine → Pas encore indexé
- Problème sitemap → Vérifier GSC UI

**Solution :**
```bash
# Re-run ETL pour rattraper les données finales
npm run run:once
```

### **Vérifier Intégrité Données**

```sql
-- 1. Vérifier cohérence clicks ≤ impressions
SELECT COUNT(*) as invalid_rows
FROM `moverz-dashboard.analytics_core.gsc_daily_metrics`
WHERE clicks > impressions;
-- Attendu: 0

-- 2. Vérifier couverture par domaine
SELECT 
  domain,
  MIN(date) as first_date,
  MAX(date) as last_date,
  COUNT(DISTINCT date) as days_count
FROM `moverz-dashboard.analytics_core.gsc_daily_metrics`
GROUP BY domain;

-- 3. Comparer totaux avec GSC UI
SELECT 
  date,
  SUM(clicks) as total_clicks,
  SUM(impressions) as total_impressions
FROM `moverz-dashboard.analytics_core.gsc_daily_metrics`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY date
ORDER BY date DESC;
```

---

## 📊 Logs & Monitoring

### **Lire Logs (CapRover)**

```bash
# Real-time
caprover logs -a dd-dashboard -f

# Dernières 100 lignes
caprover logs -a dd-dashboard --lines 100

# Filtrer par domaine
caprover logs -a dd-dashboard | grep "marseille"
```

### **Logs JSON (Pino)**

**Format :**
```json
{
  "level": 30,
  "time": 1703520000000,
  "domain": "devis-demenageur-marseille.fr",
  "rowsInserted": 1234,
  "duration": 5678,
  "msg": "Domain processed successfully"
}
```

**Niveaux :**
- `10` : TRACE (debug détaillé)
- `20` : DEBUG
- `30` : INFO (défaut)
- `40` : WARN
- `50` : ERROR
- `60` : FATAL

---

## 🆘 Support

**Problème persistant ?**
- Consulter `STATUS.md` pour l'inventaire complet
- Consulter `CAPROVER-DEPLOY.md` pour le déploiement
- GitHub Issues : [moverz_dashboard/issues](https://github.com/gdetaisne/moverz_dashboard/issues)

**Contact :**
- Email : guillaume@moverz.io

