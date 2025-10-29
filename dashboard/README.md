# 🌐 Dashboard - Interface Web Admin

Dashboard Next.js pour visualisation des données analytics.

## 📁 Structure

```
dashboard/
├── app/                         # Next.js App Router
│   ├── (auth)/                  # Pages protégées
│   │   ├── overview/            # Vue globale multi-sites
│   │   ├── sites/               # Détail par site
│   │   │   └── [city]/
│   │   ├── agents/              # Suivi agents IA
│   │   └── alerts/              # Alertes & anomalies
│   ├── api/                     # API endpoints
│   │   ├── kpis/
│   │   └── alerts/
│   ├── login/
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── charts/                  # Graphiques réutilisables
│   ├── kpis/                    # Widgets KPIs
│   └── tables/                  # Tableaux données
├── lib/
│   ├── bigquery.ts              # Client BigQuery
│   └── auth.ts                  # Authentification
├── public/
├── next.config.js
├── package.json
└── tsconfig.json
```

## 🚀 Développement

```bash
# Installer les dépendances
cd dashboard
npm install

# Lancer en dev
npm run dev

# Ouvrir http://localhost:3100
```

## 📊 Pages

### 1. `/overview` - Vue Globale
- KPIs multi-sites (impressions, clics, leads)
- Tendances 90 jours
- Comparaison inter-villes
- Top 10 pages globales

### 2. `/sites/[city]` - Détail Ville
- KPIs ville (SEO, conversions, performance)
- Top pages & requêtes
- Entonnoir conversion
- Web Vitals

### 3. `/agents` - Suivi Agents IA
- Statut agents (actif, dernière exécution)
- Actions suggérées
- Historique analyses
- Logs & erreurs

### 4. `/alerts` - Alertes & Anomalies
- Liste alertes actives
- Historique alertes résolues
- Configuration règles
- Notifications

## 🔐 Authentification

**JWT-based auth** :
```typescript
// Connexion
POST /api/auth/login
{ email, password }

// Header requis
Authorization: Bearer <token>
```

**Users** : Géré dans `.env`
```bash
ADMIN_EMAIL=guillaume@moverz.io
ADMIN_PASSWORD_HASH=...
```

## 🎨 Stack UI

- **Framework** : Next.js 14 (App Router)
- **Styling** : Tailwind CSS
- **Charts** : Recharts ou Chart.js
- **Tables** : TanStack Table
- **Forms** : React Hook Form + Zod
- **Icons** : Lucide React

## 📡 API Endpoints

### GET `/api/kpis/global`
```typescript
// Query params
{ period: '7d' | '28d' | '90d', city?: string }

// Response
{
  impressions: 120000,
  clicks: 4500,
  ctr: 0.0375,
  position: 12.3,
  leads: 456
}
```

### GET `/api/alerts`
```typescript
// Response
{
  alerts: [
    {
      id: "alert-123",
      type: "critical",
      site: "marseille",
      metric: "impressions",
      message: "Chute de visibilité -30%",
      created_at: "2025-10-29T10:00:00Z"
    }
  ]
}
```

## 🚀 Déploiement

### Build production

```bash
npm run build
npm run start
```

### Variables d'environnement

```bash
# BigQuery (readonly)
GCP_PROJECT_ID=moverz-analytics
GOOGLE_SERVICE_ACCOUNT_KEY=...

# Auth
JWT_SECRET=...

# App
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard.moverz.io
```

### Options de déploiement

1. **Vercel** (recommandé)
   - Push vers GitHub
   - Auto-deploy

2. **CapRover** (self-hosted)
   - Dockerfile fourni
   - Push via webhook

3. **Docker standalone**
   ```bash
   docker build -t moverz-dashboard .
   docker run -p 3100:3100 moverz-dashboard
   ```

---

**Documentation complète** : `/docs/guides/dashboard-dev.md`

