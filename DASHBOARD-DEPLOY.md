# 🌐 Dashboard Web - Guide Déploiement

Guide pour déployer le dashboard Next.js sur CapRover.

---

## 📊 Mode de Fonctionnement

Le Dockerfile supporte maintenant **2 modes** :

### **Mode 1 : ETL (Process Court)** 🔄
```bash
APP_MODE=etl
→ Lance l'ETL GSC, upsert BigQuery, puis sort
→ Utilisé pour les cron jobs quotidiens
```

### **Mode 2 : Dashboard (Long-Running)** 🌐
```bash
APP_MODE=dashboard  (défaut)
→ Lance le serveur Next.js sur le port 3000
→ Interface web accessible via https://dd-dashboard.gslv.cloud
```

---

## 🚀 Déploiement CapRover

### **Option A : Dashboard Web (Recommandé)**

**1. Modifier Variables d'Env dans CapRover UI**

```bash
Apps → dd-dashboard → Configurations de l'App → Environment Variables

# AJOUTER ou MODIFIER:
APP_MODE=dashboard
PORT=3000

# GARDER les existantes:
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GCP_SA_KEY_JSON={"type":"service_account",...}
SITES_LIST=devis-demenageur-marseille.fr,...
```

**2. Activer HTTPS (si pas déjà fait)**

```
Apps → dd-dashboard → Paramètres HTTP
→ ✅ Forcer HTTPS
→ ✅ Support Websocket
→ Activer HTTPS (bouton)
```

**3. Redéployer**

```
Apps → dd-dashboard → Deployment
→ Click "Force Rebuild"
```

**4. Accéder au Dashboard**

```
https://dd-dashboard.gslv.cloud
```

---

### **Option B : ETL Cron (Mode Existant)**

Si tu veux garder uniquement l'ETL (sans dashboard web) :

```bash
# Variables d'env CapRover:
APP_MODE=etl

# Persistent Apps → Ajouter Cron Job:
Schedule: 15 3 * * *
Command: ./start.sh
```

---

### **Option C : Les 2 en Parallèle** (2 Apps CapRover)

**App 1 : `dd-dashboard` (Dashboard Web)**
```bash
APP_MODE=dashboard
PORT=3000
→ One-Click App: Persistent
→ HTTPS activé
```

**App 2 : `dd-etl` (ETL Cron)**
```bash
APP_MODE=etl
→ Persistent Apps → Cron Job: 15 3 * * *
```

---

## ✅ Vérification Déploiement Dashboard

### **1. Vérifier Logs**

```bash
# Via CapRover UI
Apps → dd-dashboard → Logs

# Attendu (mode dashboard):
🚀 Starting moverz_dashboard in mode: dashboard
🌐 Starting Dashboard (Next.js on port 3000)
▲ Next.js 14.2.0
- Local: http://localhost:3000
✓ Ready in 2.3s
```

### **2. Tester Interface Web**

```bash
# Ouvrir dans navigateur
https://dd-dashboard.gslv.cloud

# Pages attendues:
/ → Vue globale (KPIs, charts, table sites)
/sites → Analyse par site (top pages/queries)
/settings → Paramètres
```

### **3. Tester API Routes**

```bash
# KPIs globaux
curl https://dd-dashboard.gslv.cloud/api/metrics/global?days=7

# Time series
curl https://dd-dashboard.gslv.cloud/api/metrics/timeseries?days=30

# Top pages
curl https://dd-dashboard.gslv.cloud/api/metrics/pages?limit=10

# Top queries
curl https://dd-dashboard.gslv.cloud/api/metrics/queries?limit=10
```

---

## 🔧 Configuration

### **Variables d'Environnement**

| Variable | Mode | Description |
|----------|------|-------------|
| `APP_MODE` | Tous | `dashboard` (web), `etl` (cron), `dev` (scheduler) |
| `PORT` | Dashboard | Port du serveur Next.js (défaut: 3000) |
| `GCP_PROJECT_ID` | Tous | Projet Google Cloud |
| `BQ_DATASET` | Tous | Dataset BigQuery |
| `GCP_SA_KEY_JSON` | Tous | Credentials Service Account (JSON) |
| `SITES_LIST` | Tous | Liste des 11 domaines (CSV) |
| `NODE_ENV` | Tous | `production` |

### **Ports CapRover**

```
# Mode Dashboard:
Container Port: 3000 (Next.js)
CapRover Port HTTP du Conteneur: 3000

# Mode ETL:
Aucun port (process court)
```

---

## 📊 Features Dashboard

### **Page Accueil (Vue Globale)**
- ✅ 4 KPI Cards (Impressions, Clics, CTR, Position)
- ✅ Trends (comparaison période précédente)
- ✅ Graphiques évolution (30 jours)
- ✅ Table performance par site
- ✅ Filtres période (7/28/90 jours)

### **Page Sites**
- ✅ Grid des 11 sites (cliquables)
- ✅ KPIs détaillés par site
- ✅ Top 10 pages (triable)
- ✅ Top 10 requêtes (triable)

### **Page Paramètres**
- ✅ Config BigQuery
- ✅ Statut ETL
- ✅ Informations système

---

## 🐛 Troubleshooting

### **Dashboard ne charge pas**

**Vérifier logs CapRover :**
```bash
caprover logs -a dd-dashboard -f

# Si erreur "GCP_SA_KEY_JSON is required":
→ Vérifier variable d'env dans CapRover UI

# Si erreur "Cannot find module":
→ Rebuild: Force Rebuild dans Deployment
```

### **Données vides dans le dashboard**

**Vérifier BigQuery :**
```sql
-- Données présentes ?
SELECT COUNT(*) FROM `moverz-dashboard.analytics_core.gsc_daily_metrics`

-- Si 0 rows:
→ Lancer ETL manuellement (voir ci-dessous)
```

**Lancer ETL manuellement :**
```bash
# SSH dans container
caprover exec -a dd-dashboard

# Lancer ETL
APP_MODE=etl ./start.sh

# Ou directement:
npx tsx etl/gsc/fetch-simple.ts
```

### **Erreur API Routes 500**

**Vérifier logs :**
```bash
caprover logs -a dd-dashboard | grep "API.*error"

# Erreurs communes:
# - "Permission denied" → Service Account permissions
# - "Table not found" → Migrations BigQuery non appliquées
# - "Syntax error" → Query SQL invalide
```

**Vérifier BigQuery schema :**
```sql
-- Table existe ?
SELECT table_name FROM `moverz-dashboard.analytics_core.INFORMATION_SCHEMA.TABLES`

-- Si manquante:
→ Appliquer migrations: db/migrations/002_gsc_simple.sql
```

---

## 🔄 Rollback

### **Revenir au mode ETL uniquement**

```bash
# Dans CapRover UI:
Apps → dd-dashboard → Configurations de l'App → Environment Variables

# Modifier:
APP_MODE=etl  (au lieu de dashboard)

# Redémarrer app
Apps → dd-dashboard → App Configs → Restart
```

### **Revenir à version précédente**

```bash
# Via CapRover UI:
Apps → dd-dashboard → Deployment → Historique des Versions
→ Sélectionner version précédente (ex: Version 7)
→ Deploy
```

---

## 📈 Performance

### **Optimisations Next.js**

- ✅ **Server Components** : Rendu côté serveur par défaut
- ✅ **Static Generation** : Pages pré-générées
- ✅ **API Caching** : Cache des queries BigQuery
- ✅ **Code Splitting** : Chunks JS automatiques
- ✅ **Standalone Output** : Image Docker optimisée

### **Métriques Attendues**

| Métrique | Valeur |
|----------|--------|
| **Build time** | ~3-5 min (CapRover) |
| **Cold start** | ~5-10s (premier accès) |
| **Page load** | <2s (après cache) |
| **API response** | ~500ms-1s (BigQuery) |
| **Memory usage** | ~150-250 MB |

---

## ✅ Checklist Déploiement

### Avant Deploy
- [ ] Variables d'env configurées (APP_MODE=dashboard, etc.)
- [ ] Service Account a les permissions BigQuery
- [ ] Table `gsc_daily_metrics` existe dans BigQuery
- [ ] Au moins quelques lignes de données dans BigQuery

### Après Deploy
- [ ] Build réussi (pas d'erreurs dans logs)
- [ ] Dashboard accessible à https://dd-dashboard.gslv.cloud
- [ ] Page / charge les KPIs correctement
- [ ] Page /sites affiche les 11 sites
- [ ] API routes retournent des données (pas 500)
- [ ] Graphiques s'affichent correctement

### Optionnel
- [ ] ETL cron configuré (mode etl en parallèle)
- [ ] Notifications Slack (à venir)
- [ ] Monitoring (Sentry, LogRocket, etc.)

---

**🎉 Dashboard Ready !**  
**Accessible à** : https://dd-dashboard.gslv.cloud

