# 🚀 Déploiement CapRover - Moverz Dashboard

Guide de déploiement sur CapRover pour l'app `dd-dashboard`.

---

## 📋 Prérequis

- ✅ App CapRover `dd-dashboard` créée
- ✅ Service account Google Cloud (`sa-key.json`)
- ✅ Variables d'environnement configurées

---

## 🔧 Variables d'Environnement CapRover

### Configuration actuelle (à conserver)

```bash
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000

# Google Cloud
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
BQ_TABLE_NAME=gsc_daily_metrics
GOOGLE_APPLICATION_CREDENTIALS=/app/sa-key.json

# Sites (CSV)
SITES_LIST=devis-demenageur-marseille.fr,devis-demenageur-strasbourg.fr,devis-demenageur-lille.fr,devis-demenageur-rennes.fr,devis-demenageur-rouen.fr,devis-demenageur-nice.fr,devis-demenageur-nantes.fr,devis-demenageur-lyon.fr,devis-demenageur-toulousain.fr,bordeaux-demenageur.fr,devis-demenageur-montpellier.fr

# ETL
FETCH_DAYS=3
TIMEZONE=Europe/Paris

# Service Account Key (base64)
GCP_SA_KEY=----BEGIN PRIVATE KEY-----\n...(ton contenu actuel)...
```

### Variables à ajouter (optionnelles)

```bash
# Phase 1 : GA4 (quand configuré)
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX

# Phase 4 : Agents IA (quand configuré)
OPENAI_API_KEY=sk-proj-xxxxx
OPENAI_MODEL=gpt-4-turbo-preview

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

---

## 📦 Structure Déploiement

### Dockerfile

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Installer dépendances
COPY package*.json ./
RUN npm ci --only=production

# Copier code source
COPY . .

# Créer sa-key.json depuis env
RUN echo "$GCP_SA_KEY" > /app/sa-key.json

# Build (si dashboard Next.js)
# RUN npm run build

# Exposer port
EXPOSE 3000

# Lancer scheduler ETL
CMD ["npm", "run", "dev"]
```

### captain-definition

```json
{
  "schemaVersion": 2,
  "dockerfilePath": "./Dockerfile"
}
```

---

## 🚀 Déploiement

### Option A : Git Push (recommandé)

```bash
# 1. Commit les changements
git add -A
git commit -m "feat: update to new architecture"

# 2. Push vers CapRover
git push caprover main

# 3. CapRover rebuild automatiquement (~5-10 min)
```

### Option B : CLI CapRover

```bash
# Installer CLI
npm install -g caprover

# Deploy
caprover deploy
```

### Option C : Tar Upload

```bash
# Créer archive
tar -czf deploy.tar.gz .

# Upload via CapRover UI
# Apps → dd-dashboard → Deployment → Upload Tar
```

---

## 🧪 Tester Après Déploiement

### 1. Vérifier les logs

```bash
# Via CapRover UI
Apps → dd-dashboard → Logs

# Ou via CLI
caprover logs -a dd-dashboard -f
```

**Logs attendus :**
```
📝 Configuration:
  GCP_PROJECT_ID: moverz-dashboard
  BQ_DATASET: analytics_core
  SITES: 11 sites
  NODE_ENV: production

🚀 Starting ETL Scheduler...
⏰ GSC ETL scheduled: daily at 09:00
⏰ Leads Sync scheduled: daily at 10:00
⏰ Web Vitals Aggregation scheduled: daily at 11:00
✅ Scheduler started successfully
```

### 2. Tester l'API (si dashboard web)

```bash
# Health check
curl https://dd-dashboard.your-domain.com/api/health

# KPIs
curl https://dd-dashboard.your-domain.com/api/kpis/global
```

### 3. Tester ETL manuellement

```bash
# SSH dans le container
caprover exec -a dd-dashboard

# Lancer ETL GSC
npm run etl:gsc

# Vérifier les données dans BigQuery
bq query --use_legacy_sql=false \
  "SELECT site, SUM(impressions) as total_impressions 
   FROM analytics_core.gsc_global 
   WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
   GROUP BY site"
```

---

## 🔐 Sécurité Service Account

### Vérifier les permissions

```bash
# Le service account doit avoir :
# - BigQuery Data Editor
# - BigQuery Job User
# - Search Console Viewer

# Vérifier dans GCP Console :
# IAM & Admin → Service Accounts → moverz-etl@...
```

### Régénérer la clé (si compromise)

```bash
# 1. Créer nouvelle clé
gcloud iam service-accounts keys create new-key.json \
  --iam-account=moverz-etl@moverz-dashboard.iam.gserviceaccount.com

# 2. Convertir en base64 (pour CapRover)
cat new-key.json | base64 | tr -d '\n' > key-base64.txt

# 3. Mettre à jour GCP_SA_KEY dans CapRover UI

# 4. Supprimer ancienne clé
gcloud iam service-accounts keys list \
  --iam-account=moverz-etl@moverz-dashboard.iam.gserviceaccount.com

gcloud iam service-accounts keys delete OLD_KEY_ID \
  --iam-account=moverz-etl@moverz-dashboard.iam.gserviceaccount.com
```

---

## 📊 Monitoring

### CapRover Metrics

```
Apps → dd-dashboard → Metrics

- CPU Usage: <20% (idle), <60% (ETL running)
- Memory: ~200-300 MB (idle), ~500 MB (ETL running)
- Restart count: 0 (stable)
```

### BigQuery Monitoring

```sql
-- Vérifier dernière exécution ETL
SELECT 
  job_name,
  started_at,
  completed_at,
  status,
  rows_processed
FROM analytics_core.etl_jobs_log
ORDER BY started_at DESC
LIMIT 10
```

### Alertes (Phase 3)

```sql
-- Vérifier alertes actives
SELECT *
FROM analytics_core.alerts
WHERE resolved = FALSE
ORDER BY created_at DESC
```

---

## 🐛 Troubleshooting

### Erreur "Service account not found"

```bash
# Vérifier que GCP_SA_KEY est bien défini
# Vérifier que /app/sa-key.json est créé
caprover exec -a dd-dashboard
cat /app/sa-key.json | head -5
```

### Erreur "Permission denied BigQuery"

```bash
# Vérifier les permissions du service account
gcloud projects get-iam-policy moverz-dashboard \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:moverz-etl@*"
```

### ETL ne se lance pas

```bash
# Vérifier les logs
caprover logs -a dd-dashboard -f

# Vérifier les cron jobs (si planifiés)
# Vérifier que TIMEZONE=Europe/Paris est défini
```

### Build Docker échoue

```bash
# Vérifier package.json
# Vérifier que node_modules est dans .dockerignore
# Essayer de rebuild localement :
docker build -t test-dashboard .
docker run -it test-dashboard sh
```

---

## 🔄 Rollback

### Revenir à version précédente

```bash
# Via CapRover UI
Apps → dd-dashboard → Deployment → Previous Builds
→ Sélectionner version → Deploy

# Ou via Git
git revert HEAD
git push caprover main
```

---

## 📈 Prochaines Étapes

### Phase 1 : Validation
- [ ] ETL GSC fonctionne quotidiennement
- [ ] Données visibles dans BigQuery
- [ ] Aucune erreur dans les logs

### Phase 2 : Dashboard Web
- [ ] Déployer interface Next.js
- [ ] Configurer authentification
- [ ] Tester visualisations

### Phase 3 : Agents IA
- [ ] Ajouter OPENAI_API_KEY
- [ ] Tester agent SEO
- [ ] Configurer notifications Slack

---

**✅ Système prêt pour CapRover !**  
**📊 Compatible avec ta config existante**  
**🚀 Déploiement en 1 push Git**

