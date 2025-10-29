# Moverz Analytics Dashboard

Dashboard web Next.js 14 pour visualiser les données analytics du réseau Moverz (11 sites).

## 🎯 Features

- **Vue Globale** : KPIs agrégés des 11 sites
- **Graphiques** : Évolution temporelle (impressions, clics, CTR, position)
- **Par Site** : Analyse détaillée par ville avec top pages/queries
- **Responsive** : Interface adaptée mobile/tablet/desktop
- **Real-time** : Données synchronisées depuis BigQuery

## 🚀 Développement Local

```bash
# Installer dépendances
npm install

# Configurer .env (copier .env.example)
cp .env.example .env

# Lancer serveur dev
npm run dev

# Ouvrir http://localhost:3000
```

## 📦 Production

```bash
# Build
npm run build

# Start
npm start -p 3000
```

## 🔧 Variables d'Environnement

```bash
# Google Cloud
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GCP_SA_KEY_JSON={"type":"service_account",...}

# Next.js
NODE_ENV=production
PORT=3000
```

## 📊 Stack Technique

- **Framework** : Next.js 14 (App Router)
- **Styling** : Tailwind CSS
- **Charts** : Recharts
- **Icons** : Lucide React
- **Database** : BigQuery (via @google-cloud/bigquery)
- **TypeScript** : Strict mode

## 🏗️ Structure

```
dashboard/
├── app/
│   ├── page.tsx          # Home (vue globale)
│   ├── sites/page.tsx    # Analyse par site
│   ├── settings/page.tsx # Paramètres
│   ├── api/              # API Routes BigQuery
│   │   └── metrics/
│   │       ├── global/
│   │       ├── timeseries/
│   │       ├── pages/
│   │       └── queries/
│   ├── layout.tsx        # Layout principal
│   └── globals.css       # Styles globaux
├── components/
│   ├── Navigation.tsx    # Nav bar
│   ├── MetricCard.tsx    # Carte KPI
│   ├── TimeSeriesChart.tsx
│   ├── DataTable.tsx
│   └── PeriodSelector.tsx
├── lib/
│   ├── bigquery.ts       # Queries BigQuery
│   └── utils.ts          # Helpers
└── public/               # Assets statiques
```

## 🔐 Sécurité

- Pas d'exposition des credentials en client
- API Routes avec validation
- Headers de sécurité (CSP, X-Frame-Options)
- Pas de logs sensibles

## 📈 Performance

- Server Components par défaut
- Images optimisées (next/image)
- Build output: standalone (Docker)
- Caching API Routes

## 🚢 Déploiement

Voir [CAPROVER-DEPLOY.md](../CAPROVER-DEPLOY.md) dans le repo parent.
