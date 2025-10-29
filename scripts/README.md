# 🛠️ Scripts - Utilitaires & Automatisation

Scripts de setup, déploiement et tests.

## 📁 Structure

```
scripts/
├── setup/                       # Configuration initiale
│   ├── init-ga4.sh              # Setup Google Analytics 4
│   ├── init-bigquery.sh         # Setup BigQuery
│   └── create-service-account.sh
├── deploy/                      # Déploiement
│   ├── sync-tracking-to-sites.sh # Déployer tracking sur 11 sites
│   └── deploy-etl.sh            # Déployer ETL jobs
└── test/                        # Tests & validation
    ├── test-ga4-events.ts       # Tester événements GA4
    ├── test-etl.ts              # Tester ETL
    └── validate-bigquery.ts     # Valider schéma BigQuery
```

## 🚀 Usage

### Setup initial

```bash
# 1. Configurer GA4
npm run setup:ga4

# 2. Configurer BigQuery
npm run setup:bigquery

# 3. Créer service account
bash scripts/setup/create-service-account.sh
```

### Déploiement

```bash
# Déployer tracking sur moverz_main (11 sites)
npm run deploy:tracking

# Déployer ETL jobs (Cloud Functions)
bash scripts/deploy/deploy-etl.sh
```

### Tests

```bash
# Tester événements GA4
npm run test:events

# Tester ETL complet
npm test
```

## 📝 Scripts détaillés

### `setup/init-ga4.sh`
**Objectif** : Créer propriété GA4 + 11 data streams

```bash
#!/bin/bash
# Guide interactif de configuration GA4
# - Créer compte GA4
# - Créer propriété "Moverz Multi-Sites"
# - Créer 11 data streams (1 par domaine)
# - Configurer events custom
# - Activer export BigQuery
```

### `setup/init-bigquery.sh`
**Objectif** : Setup projet BigQuery

```bash
#!/bin/bash
# - Créer projet GCP
# - Activer API BigQuery
# - Créer dataset "moverz"
# - Appliquer migrations
# - Seed sites
```

### `deploy/sync-tracking-to-sites.sh`
**Objectif** : Déployer code tracking sur moverz_main

```bash
#!/bin/bash
# - Copier fichiers tracking (ga4.ts, ga-listener.tsx)
# - Sync vers 11 sites via scripts/sync-components.sh
# - Push vers GitHub (11 repos)
# - Rebuild CapRover automatique
```

### `test/test-ga4-events.ts`
**Objectif** : Valider événements GA4

```typescript
// Tester :
// - page_view
// - cta_click (hero, sticky, article)
// - form_start
// - form_submit
//
// Via Measurement Protocol ou DebugView
```

## 🔧 Prérequis

### Tools nécessaires

```bash
# Google Cloud CLI
brew install google-cloud-sdk

# Node.js 20+
node --version

# Git
git --version
```

### Authentification

```bash
# Google Cloud
gcloud auth login
gcloud config set project moverz-analytics

# GitHub (pour deploy)
gh auth login
```

## 📊 Checklist setup complet

### Phase 1 : GA4 & Tracking

- [ ] Exécuter `init-ga4.sh`
- [ ] Noter GA4_ID (G-XXXXXXXXXX)
- [ ] Mettre à jour `.env`
- [ ] Générer fichiers tracking
- [ ] Tester localement (1 site)
- [ ] Déployer sur 11 sites
- [ ] Valider événements (DebugView)

### Phase 2 : BigQuery

- [ ] Exécuter `init-bigquery.sh`
- [ ] Créer service account
- [ ] Télécharger credentials.json
- [ ] Mettre à jour `.env`
- [ ] Appliquer migrations
- [ ] Seed sites
- [ ] Valider tables créées

### Phase 3 : ETL

- [ ] Configurer GSC API
- [ ] Tester ETL GSC
- [ ] Configurer export GA4 → BigQuery
- [ ] Tester ETL leads
- [ ] Tester ETL Web Vitals
- [ ] Déployer scheduler (cron)

### Phase 4 : Dashboard

- [ ] Installer dépendances
- [ ] Configurer auth
- [ ] Tester connexion BigQuery
- [ ] Build production
- [ ] Déployer (Vercel/CapRover)

### Phase 5 : Agents IA

- [ ] Configurer OpenAI API
- [ ] Tester agent SEO
- [ ] Configurer notifications (Slack)
- [ ] Déployer orchestrateur
- [ ] Valider rapports automatiques

## 🐛 Troubleshooting

### Erreur "gcloud not found"
```bash
# Installer Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

### Erreur permissions BigQuery
```bash
# Vérifier permissions service account
gcloud projects get-iam-policy moverz-analytics \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*"
```

### Erreur push GitHub
```bash
# Vérifier accès repos
gh auth status

# Re-authentifier si besoin
gh auth login
```

---

**Documentation complète** : `/docs/guides/`

