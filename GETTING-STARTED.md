# 🚀 Getting Started - Moverz Analytics

**Guide de démarrage rapide** pour lancer le système analytics complet.

---

## 📋 Vue d'ensemble

Ce projet est **prêt à l'emploi** et contient :

✅ **ETL complet** : Google Search Console, Leads, Web Vitals  
✅ **BigQuery** : 8 tables + migrations  
✅ **Agents IA** : SEO Optimizer (GPT-4)  
✅ **Scripts setup** : Automatisation complète  
✅ **Scripts tests** : Validation end-to-end  

---

## ⚡ Quick Start (5 étapes)

### 1️⃣ **Installer les dépendances**

```bash
npm install
```

### 2️⃣ **Configurer BigQuery**

```bash
npm run setup:bigquery
```

Ce script va :
- Créer le projet GCP `moverz-analytics`
- Activer les APIs BigQuery + Search Console
- Créer le dataset `moverz`
- Créer le service account avec permissions
- Générer la clé JSON `credentials/service-account.json`
- Appliquer les migrations (8 tables)
- Seed les 11 sites

⏱️ **Durée** : ~5-10 minutes

### 3️⃣ **Configurer Google Analytics 4**

```bash
npm run setup:ga4
```

Ce script (guide interactif) va :
- Vous guider pour créer la propriété GA4
- Créer les 11 data streams
- Activer l'export BigQuery
- **Générer automatiquement** les fichiers tracking Next.js

⏱️ **Durée** : ~10-15 minutes (dont 80% manuel dans l'UI GA4)

### 4️⃣ **Déployer le tracking sur moverz_main**

```bash
# Définir le chemin vers moverz_main
export MOVERZ_MAIN_PATH=../moverz_main

# Copier les fichiers tracking
cd scripts/deploy
./sync-tracking-to-sites.sh
```

Ce script va :
- Copier `ga4.ts` et `ga-listener.tsx` sur les 11 sites
- Proposer de commit/push automatiquement
- Afficher les instructions pour modifier `layout.tsx`

⏱️ **Durée** : ~2-3 minutes

### 5️⃣ **Tester & Valider**

```bash
# Valider BigQuery
npm run test -- scripts/test/validate-bigquery.ts

# Tester GA4 (après déploiement)
npm run test:events
```

⏱️ **Durée** : ~1 minute

---

## 🎯 Après le Quick Start

### Lancer le premier ETL

```bash
# GSC (nécessite que les sites soient vérifiés dans Search Console)
npm run etl:gsc

# Leads (nécessite DATABASE_URL configurée)
npm run etl:leads
```

### Lancer le scheduler quotidien

```bash
# Lance les 3 ETL quotidiens (09:00, 10:00, 11:00)
npm run dev
```

### Tester l'agent SEO

```bash
# Lance l'agent SEO Optimizer
cd agents/seo-optimizer
tsx agent.ts
```

---

## 📁 Fichiers Importants

### Configuration

```
.env                              # Variables d'environnement
credentials/service-account.json  # Clé Google Cloud (généré par setup)
```

### Scripts

```
scripts/setup/init-bigquery.sh    # Setup BigQuery complet
scripts/setup/init-ga4.sh         # Guide GA4 + génération tracking
scripts/deploy/sync-tracking-to-sites.sh  # Déploiement tracking
scripts/test/validate-bigquery.ts # Tests BigQuery
scripts/test/test-ga4-events.ts   # Tests GA4
```

### Code

```
etl/gsc/fetch.ts                  # ETL Google Search Console
etl/leads/sync.ts                 # ETL Leads PostgreSQL → BigQuery
etl/scheduler.ts                  # Orchestrateur quotidien
agents/seo-optimizer/agent.ts     # Agent SEO (GPT-4)
```

---

## 🔐 Variables d'Environnement

### Obligatoires (Phase 1-2)

```bash
# BigQuery
GCP_PROJECT_ID=moverz-analytics
BIGQUERY_DATASET=moverz
GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account.json

# GA4
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX

# PostgreSQL (pour ETL leads)
DATABASE_URL=postgresql://user:pass@localhost:5432/demenagement_app
```

### Optionnelles (Phase 4)

```bash
# OpenAI (pour agents IA)
OPENAI_API_KEY=sk-proj-xxxxx
OPENAI_MODEL=gpt-4-turbo-preview

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

---

## 🧪 Tests & Validation

### Checklist de validation

```bash
# 1. BigQuery setup OK ?
npm run test -- scripts/test/validate-bigquery.ts

# ✅ Attendu:
#   - 8 tables existent
#   - 11 sites dans table 'sites'
#   - Permissions OK (INSERT + SELECT)
#   - Schéma valide

# 2. GA4 events OK ?
npm run test:events

# ✅ Attendu (après déploiement):
#   - Événements visibles dans GA4 DebugView
#   - 4 types d'événements: page_view, cta_click, form_start, form_submit

# 3. ETL GSC OK ?
npm run etl:gsc

# ✅ Attendu (si Search Console configuré):
#   - Données insérées dans gsc_global, gsc_pages, gsc_queries
#   - 0 erreurs
#   - Status: success

# 4. Agent SEO OK ?
cd agents/seo-optimizer && tsx agent.ts

# ✅ Attendu (si données GSC + OpenAI configuré):
#   - 5-10 actions générées
#   - Summary en français
#   - JSON valide
```

---

## 🐛 Troubleshooting

### Erreur "gcloud not found"

```bash
# Installer Google Cloud SDK
brew install google-cloud-sdk
# ou
curl https://sdk.cloud.google.com | bash
```

### Erreur "Service account permissions"

```bash
# Vérifier les permissions
gcloud projects get-iam-policy moverz-analytics

# Réattribuer si nécessaire
bash scripts/setup/init-bigquery.sh
```

### Erreur "GA4_ID not found"

```bash
# Vérifier .env
grep NEXT_PUBLIC_GA4_ID .env

# Si manquant, ajouter
echo "NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX" >> .env
```

### Erreur "Table not found"

```bash
# Réappliquer les migrations
bq query --use_legacy_sql=false < db/migrations/001_initial.sql

# Seed les sites
npm run db:seed
```

---

## 📚 Documentation Complète

| Document | Contenu |
|----------|---------|
| `README.md` | Vue d'ensemble + roadmap |
| `GETTING-STARTED.md` | Ce guide (quick start) |
| `CHANGELOG.md` | Historique des versions |
| `docs/PLAN-ANALYTICS-HYBRIDE-FINAL.md` | Architecture complète |
| `etl/README.md` | Documentation ETL |
| `agents/README.md` | Documentation agents IA |
| `scripts/README.md` | Documentation scripts |

---

## 🎯 Prochaines Étapes

### Phase 1 (en cours) ✅
- [x] ETL GSC, Leads, Web Vitals
- [x] BigQuery setup complet
- [x] Scripts setup automatisés
- [x] Génération tracking GA4
- [x] Scripts tests

### Phase 2 (prochaine)
- [ ] Configurer Search Console (vérifier 11 domaines)
- [ ] Lancer premier ETL GSC (données réelles)
- [ ] Configurer export GA4 → BigQuery
- [ ] Tester agent SEO avec vraies données

### Phase 3 (Dashboard)
- [ ] Dashboard Next.js (vue globale + détail)
- [ ] Graphiques (Recharts)
- [ ] API endpoints

### Phase 4 (Agents IA)
- [ ] Agent Content Strategist
- [ ] Agent CRO Optimizer
- [ ] Agent Report Generator
- [ ] Agent Alerts Manager

---

## 💡 Besoin d'Aide ?

**Issues GitHub** : [github.com/gdetaisne/moverz_dashboard/issues](https://github.com/gdetaisne/moverz_dashboard/issues)  
**Email** : guillaume@moverz.io  
**Documentation** : `/docs/`

---

**✅ Système prêt à l'emploi !**  
**⏱️ Temps total setup : ~20-30 minutes**  
**🚀 Bon analytics !**

