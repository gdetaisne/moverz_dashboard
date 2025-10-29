# 📊 PLAN ANALYTICS HYBRIDE - MOVERZ

**Date** : 29 Octobre 2025  
**Version** : 1.0 FINAL  
**Statut** : ✅ VALIDÉ - Prêt à implémenter

---

## 🎯 Vision & Objectifs

### Vision long terme
**Pilotage business 99% automatisé par IA**
- Décisions data-driven
- Optimisation continue automatique
- Intervention humaine = validation stratégique uniquement

### Objectifs immédiats (3 mois)
1. ✅ Mesurer évolution indexation & visibilité SEO
2. ✅ Tracker conversions (clics CTA → formulaire → lead)
3. ✅ Comparer performance des 11 villes
4. ✅ Détecter anomalies & opportunités

---

## 🧠 Philosophie : Hybride GA4 + Interne

### Principe
```
GA4 = Collecteur standardisé (fiabilité, normalisation)
  ↓
BigQuery = Cerveau analytique (flexibilité, souveraineté)
  ↓
IA = Pilote automatique (analyses, décisions, actions)
```

### Justification des choix

| Domaine | Choix | Justification |
|---------|-------|---------------|
| **Tracking principal** | GA4 | Standard, robuste, export BigQuery natif, interopérable avec Looker & IA |
| **Pilotage SEO** | GSC API | Donnée de visibilité (impressions, CTR, position) non disponible ailleurs |
| **Centralisation** | BigQuery | Source unique de vérité, format SQL, IA-compatible |
| **RGPD** | Mode hybride | GA4 sous consentement, first-party fallback sans cookie possible |
| **Performance** | Scripts différés | GA4 et GSC sans impact Core Web Vitals |
| **Évolutivité IA** | BigQuery + pipeline interne | Données exploitables par GPT pour analyses & actions |

---

## 🏗️ Architecture Technique

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    11 SITES PRODUCTION                       │
│  (Next.js 14 + GA4 tracking + Web Vitals + CTA events)      │
└────────────┬─────────────────────────────────┬──────────────┘
             │                                 │
             │ Events                          │ API calls
             ↓                                 ↓
    ┌────────────────┐              ┌──────────────────┐
    │   Google       │              │  Google Search   │
    │   Analytics 4  │              │    Console       │
    │                │              │   (11 domains)   │
    │ 1 propriété    │              └────────┬─────────┘
    │ 11 streams     │                       │
    └────────┬───────┘                       │ Daily ETL
             │ Export                        │
             │ (daily)                       │
             ↓                               ↓
    ┌────────────────────────────────────────────────┐
    │              BIGQUERY (Data Warehouse)         │
    │                                                 │
    │  Tables:                                        │
    │  • ga4_events    (comportement, conversions)   │
    │  • gsc_pages     (visibilité SEO par page)     │
    │  • gsc_queries   (keywords & positions)        │
    │  • web_vitals    (LCP, CLS, INP)              │
    │  • leads         (conversions finales)         │
    └────────┬──────────────────────────────────────┘
             │
             ├──────────────┬──────────────┬──────────────┐
             │              │              │              │
             ↓              ↓              ↓              ↓
    ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
    │  Looker    │  │ Dashboard│  │  Alertes │  │   Agents IA  │
    │  Studio    │  │  React   │  │  Slack/  │  │  (OpenAI)    │
    │ (gratuit)  │  │ (option) │  │  Email   │  │              │
    └────────────┘  └──────────┘  └──────────┘  └──────┬───────┘
                                                        │
                                                        ↓
                                              ┌──────────────────┐
                                              │  ACTIONS AUTO    │
                                              │ • Rapports       │
                                              │ • Optimisations  │
                                              │ • Décisions      │
                                              └──────────────────┘
```

---

## 📊 Sources de Données

### 1. Google Analytics 4

**Configuration** :
- 1 compte GA4
- 1 propriété : "Moverz - Réseau Multi-Sites"
- 11 data streams (1 par domaine)

**Events trackés** :
```javascript
// Automatiques
- page_view
- session_start
- first_visit

// Custom (manuels)
- cta_click : {
    cta_type: 'hero' | 'sticky' | 'article' | 'pricing',
    destination: '/devis' | URL,
    city: 'marseille' | 'toulouse' | ...
  }
  
- form_start : {
    form_type: 'lead',
    city: string
  }
  
- form_submit : {
    form_type: 'lead',
    city: string,
    fields_count: number
  }
```

**Export BigQuery** :
- Activation : gratuit jusqu'à 10 GB/mois
- Fréquence : quotidienne (J-1 disponible à 8h)
- Tables : `analytics_XXXXXX.events_YYYYMMDD`

### 2. Google Search Console (API)

**Configuration** :
- 11 propriétés "Domain" (1 par ville)
- Accès API via OAuth 2.0

**Données extraites** (quotidien) :
```javascript
// Global (par date)
{
  site: 'marseille',
  date: '2025-10-29',
  impressions: 12450,
  clicks: 456,
  ctr: 0.0366,
  position: 15.3
}

// Par page (top 100)
{
  site: 'marseille',
  date: '2025-10-29',
  url: '/blog/prix-demenagement-marseille',
  impressions: 850,
  clicks: 38,
  ctr: 0.0447,
  position: 8.2
}

// Par requête (top 100)
{
  site: 'marseille',
  date: '2025-10-29',
  query: 'déménagement marseille prix',
  impressions: 320,
  clicks: 15,
  ctr: 0.0469,
  position: 5.8
}
```

### 3. Web Vitals (RUM - Real User Monitoring)

**Collecte** :
```typescript
// Via web-vitals library
import { onLCP, onCLS, onINP } from 'web-vitals'

// Envoi vers endpoint interne ou GA4 custom event
{
  metric: 'LCP',
  value: 1850, // ms
  rating: 'good',
  url: '/blog/article',
  device: 'mobile',
  connection: '4g'
}
```

**Agrégation** :
- Par jour/site/URL
- Moyennes pondérées (p75)

### 4. Leads (Base de données interne)

**Source** : PostgreSQL (Prisma)
```typescript
// Table leads (existante ou à créer)
{
  id: uuid,
  createdAt: timestamp,
  city: string,
  source: 'organic' | 'direct' | 'referral',
  utmSource?: string,
  utmMedium?: string,
  formData: jsonb,
  status: 'pending' | 'contacted' | 'converted'
}
```

---

## 🗄️ Schéma BigQuery

### Tables principales

#### 1. `ga4_events` (export GA4 natif)
```sql
CREATE TABLE moverz.ga4_events AS
SELECT
  event_date,
  event_timestamp,
  event_name,
  user_pseudo_id,
  device.category AS device,
  geo.country,
  traffic_source.source,
  traffic_source.medium,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_url,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'cta_type') AS cta_type,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'city') AS city
FROM `analytics_XXXXXX.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20250101' AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
```

#### 2. `gsc_global` (agrégats quotidiens)
```sql
CREATE TABLE moverz.gsc_global (
  site STRING,
  date DATE,
  impressions INT64,
  clicks INT64,
  ctr FLOAT64,
  position FLOAT64,
  PRIMARY KEY (site, date)
)
```

#### 3. `gsc_pages` (performance par page)
```sql
CREATE TABLE moverz.gsc_pages (
  site STRING,
  date DATE,
  url STRING,
  impressions INT64,
  clicks INT64,
  ctr FLOAT64,
  position FLOAT64,
  PRIMARY KEY (site, date, url)
)
```

#### 4. `gsc_queries` (performance par keyword)
```sql
CREATE TABLE moverz.gsc_queries (
  site STRING,
  date DATE,
  query STRING,
  impressions INT64,
  clicks INT64,
  ctr FLOAT64,
  position FLOAT64,
  PRIMARY KEY (site, date, query)
)
```

#### 5. `web_vitals` (métriques performance)
```sql
CREATE TABLE moverz.web_vitals (
  site STRING,
  date DATE,
  url STRING,
  device STRING,
  metric STRING, -- 'LCP', 'CLS', 'INP'
  p50 FLOAT64,
  p75 FLOAT64,
  p95 FLOAT64,
  samples INT64,
  PRIMARY KEY (site, date, url, device, metric)
)
```

#### 6. `leads` (conversions)
```sql
CREATE TABLE moverz.leads (
  id STRING,
  created_at TIMESTAMP,
  site STRING,
  source STRING,
  medium STRING,
  utm_source STRING,
  utm_medium STRING,
  utm_campaign STRING,
  form_data JSON,
  status STRING,
  PRIMARY KEY (id)
)
```

---

## ⚙️ ETL & Pipeline de Données

### Job quotidien (cron)

**Timing** : Tous les jours à 9h (heure Paris)

```javascript
// Node.js + Cloud Scheduler ou cron
async function dailyETL() {
  // 1. Récupérer données GSC (11 sites)
  for (const site of SITES) {
    const gscData = await fetchGSCData(site, yesterday)
    await insertToBigQuery('moverz.gsc_global', gscData.global)
    await insertToBigQuery('moverz.gsc_pages', gscData.pages)
    await insertToBigQuery('moverz.gsc_queries', gscData.queries)
  }
  
  // 2. Agréger Web Vitals
  const vitals = await aggregateWebVitals(yesterday)
  await insertToBigQuery('moverz.web_vitals', vitals)
  
  // 3. Sync leads depuis PostgreSQL
  const leads = await fetchLeads(yesterday)
  await insertToBigQuery('moverz.leads', leads)
  
  // 4. Vérifier anomalies & alerter
  await checkAnomalies()
  
  // 5. Log succès
  console.log(`ETL completed for ${yesterday}`)
}
```

**Déploiement** :
- Option A : Cloud Function (Google Cloud)
- Option B : Cron sur serveur CapRover
- Option C : GitHub Actions (scheduled workflow)

### Authentification

**GSC API** :
```javascript
// OAuth 2.0 avec service account
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
})
```

**BigQuery** :
```javascript
const { BigQuery } = require('@google-cloud/bigquery')
const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
})
```

---

## 📈 KPIs & Métriques

### Dashboard 1 : Vue Globale Multi-Sites

**Période** : 7/28/90 jours (sélecteur)

**KPIs principaux** :
```
┌────────────────────────────────────────────────────┐
│  VISIBILITÉ SEO                                    │
│  ───────────────────────────────────────────       │
│  Impressions:  1.2M  (+12% vs période précédente) │
│  Clics:        45K   (+8% ↗)                       │
│  CTR:          3.75% (-0.2% ↘)                     │
│  Position moy: 12.3  (-1.1 ↗)                      │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  CONVERSIONS                                       │
│  ───────────────────────────────────────────       │
│  Clics CTA:    2,850  (+15% ↗)                     │
│  Form starts:  890    (+10% ↗)                     │
│  Form submits: 456    (+5% ↗)                      │
│  Taux conv:    5.1%   (= -)                        │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│  PERFORMANCE TECHNIQUE                             │
│  ───────────────────────────────────────────       │
│  LCP moyen:    2.1s   (🟢 Good)                    │
│  CLS moyen:    0.08   (🟢 Good)                    │
│  INP moyen:    180ms  (🟡 Needs improvement)       │
└────────────────────────────────────────────────────┘
```

**Graphiques** :
1. Tendance Impressions & Clics (ligne, 90j)
2. Comparaison par ville (barres)
3. Entonnoir conversion (sankey)
4. Top 10 pages (tableau)

### Dashboard 2 : Vue Détail par Site

**Sélecteur** : Ville (Marseille, Toulouse, Lyon...)

```
┌────────────────────────────────────────────────────┐
│  MARSEILLE - Vue détaillée                         │
└────────────────────────────────────────────────────┘

SEO Performance:
- Impressions:  120K  (+8%)
- Clics:        4.2K  (+5%)
- CTR:          3.5%  (-0.1%)
- Position:     11.8  (-0.8)

Top 10 Pages (par clics):
1. /blog/prix-demenagement-marseille       380 clics
2. /marseille/vieux-port                   245 clics
3. /                                       198 clics
...

Top 10 Requêtes:
1. déménagement marseille                  850 imp, 38 clics, pos 5.2
2. déménageur marseille prix               620 imp, 28 clics, pos 7.1
...

Entonnoir Conversion:
Page views:    12,500
CTA clicks:      320  (2.56%)
Form starts:      95  (29.7% des clics CTA)
Form submits:     48  (50.5% des starts)

→ Taux de conversion global: 0.38%
```

### Dashboard 3 : Alertes & Anomalies

**Règles d'alertes** :
```javascript
// 1. Chute de visibilité
if (impressions_7d < impressions_7d_previous * 0.7) {
  alert({
    type: 'critical',
    title: 'Chute de visibilité -30%',
    site: 'marseille',
    metric: 'impressions',
    current: 85000,
    previous: 120000,
    change: -29.2%
  })
}

// 2. CTR faible
if (ctr < 0.015 && impressions > 1000) {
  alert({
    type: 'warning',
    title: 'CTR très faible',
    site: 'toulouse',
    url: '/blog/article-X',
    ctr: 1.2%,
    action: 'Optimiser title/meta'
  })
}

// 3. Performance dégradée
if (lcp_p75 > 2500) {
  alert({
    type: 'warning',
    title: 'LCP dégradé',
    site: 'lyon',
    url: '/blog/article-Y',
    lcp: 2850ms,
    threshold: 2500ms
  })
}

// 4. Formulaire avec abandon élevé
if (form_abandon_rate > 0.6) {
  alert({
    type: 'info',
    title: 'Abandon formulaire élevé',
    site: 'nice',
    abandon_rate: 65%,
    action: 'Simplifier le formulaire'
  })
}
```

**Notification** :
- Slack (webhook)
- Email (SendGrid ou équivalent)
- Dashboard interne (badge rouge)

---

## 🤖 Phase IA : Agents Autonomes

### Architecture agents

```
┌─────────────────────────────────────────────────────┐
│              ORCHESTRATEUR PRINCIPAL                │
│         (GPT-4 avec accès BigQuery)                 │
└──────────┬──────────────────────────────────────────┘
           │
           ├─────────┬─────────┬─────────┬─────────┐
           ↓         ↓         ↓         ↓         ↓
      ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
      │ Agent  │ │ Agent  │ │ Agent  │ │ Agent  │ │ Agent  │
      │  SEO   │ │ Content│ │  CRO   │ │ Report │ │ Alerts │
      └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

### Agent 1 : SEO Optimizer

**Rôle** : Détecter opportunités & problèmes SEO

```javascript
// Prompt système
const SEO_AGENT_PROMPT = `
Tu es un expert SEO chargé d'analyser les données Google Search Console 
de 11 sites de déménagement par ville.

Tes missions :
1. Identifier les pages avec fort potentiel (impressions élevées, CTR faible)
2. Détecter les chutes de visibilité anormales
3. Trouver les keywords à fort volume non exploités
4. Proposer des optimisations concrètes (title, meta, contenu)

Tu as accès à BigQuery pour requêter les données.
Tu retournes des actions priorisées avec impact estimé.
`

// Exemple de requête autonome
const query = `
SELECT 
  site,
  url,
  SUM(impressions) as total_imp,
  AVG(ctr) as avg_ctr,
  AVG(position) as avg_pos
FROM moverz.gsc_pages
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND impressions > 100
GROUP BY site, url
HAVING avg_ctr < 0.02  -- CTR < 2%
ORDER BY total_imp DESC
LIMIT 20
`

// Retour de l'agent
{
  actions: [
    {
      priority: 'high',
      site: 'marseille',
      url: '/blog/prix-demenagement-marseille',
      issue: 'CTR faible (1.2%) malgré 5800 impressions',
      recommendation: 'Optimiser title : ajouter "2025" et "gratuit"',
      estimated_impact: '+150 clics/mois'
    }
  ]
}
```

### Agent 2 : Content Strategist

**Rôle** : Analyser performance contenu & suggérer articles

```javascript
// Analyse des gaps de contenu
const gap_analysis = `
Analyse les requêtes GSC avec fort volume mais position >10,
croise avec le contenu existant,
identifie les sujets manquants ou sous-optimisés.
`

// Output
{
  content_gaps: [
    {
      city: 'toulouse',
      query: 'déménagement étudiant toulouse',
      monthly_searches: 880,
      current_position: 15,
      existing_content: null,
      recommendation: 'Créer article satellite "Déménagement Étudiant Toulouse"',
      estimated_traffic: '+30 clics/mois'
    }
  ]
}
```

### Agent 3 : CRO Optimizer

**Rôle** : Optimiser le taux de conversion

```javascript
// Analyse entonnoir
const funnel_analysis = `
Analyse l'entonnoir page_view → cta_click → form_submit,
identifie les points de friction,
propose des tests A/B.
`

// Output
{
  optimizations: [
    {
      site: 'lyon',
      issue: 'Taux de clic CTA sticky faible (1.2%)',
      current_cta: 'Obtenir un devis',
      test_variants: [
        'Devis gratuit en 2 minutes',
        'Comparer 3 devis gratuitement'
      ],
      expected_lift: '+25% clics CTA'
    }
  ]
}
```

### Agent 4 : Report Generator

**Rôle** : Générer rapports hebdo automatiques

```javascript
// Rapport automatique tous les lundis
const weekly_report = {
  period: '2025-10-22 to 2025-10-28',
  summary: 'Semaine positive : +8% impressions, +12% leads',
  highlights: [
    '🟢 Nice : +45% clics (article piano publié)',
    '🔴 Marseille : -12% CTR (meta descriptions à revoir)',
    '🟡 Toulouse : formulaire abandonné 68% (simplifier ?)'
  ],
  recommendations: [
    'Prioriser optimisation meta Marseille (ROI élevé)',
    'Tester variante formulaire Toulouse (A/B test)',
    'Répliquer stratégie Nice sur autres villes'
  ],
  next_week_goals: [
    'Publier 3 articles satellites Lyon',
    'Optimiser 5 pages faible CTR',
    'Réduire abandon formulaire <60%'
  ]
}
```

### Agent 5 : Alerts Manager

**Rôle** : Surveiller & notifier anomalies

```javascript
// Monitoring continu
setInterval(async () => {
  const anomalies = await detectAnomalies()
  
  if (anomalies.length > 0) {
    await notifySlack(anomalies)
    await logToDatabase(anomalies)
    
    // Si critique, déclencher agent SEO pour diagnostic
    if (anomalies.some(a => a.severity === 'critical')) {
      await triggerSEOAgent(anomalies)
    }
  }
}, 3600000) // Toutes les heures
```

---

## 🗺️ ROADMAP D'IMPLÉMENTATION

### PHASE 1 : GA4 & Tracking de Base (Semaine 1)

**Objectif** : Collecter les premières données comportementales

**Tâches** :
```
Jour 1-2 : Configuration GA4
- [ ] Créer compte + propriété GA4
- [ ] Configurer 11 data streams (1 par domaine)
- [ ] Activer export BigQuery
- [ ] Créer events custom (cta_click, form_start, form_submit)

Jour 3-4 : Intégration Next.js
- [ ] Créer lib/analytics/ga4.ts
- [ ] Créer lib/analytics/gtag.ts
- [ ] Créer app/ga-listener.tsx (client component)
- [ ] Modifier app/layout.tsx (injection scripts)
- [ ] Ajouter tracking dans StickyCTA.tsx
- [ ] Ajouter tracking dans LeadForm.tsx
- [ ] Variables d'env (NEXT_PUBLIC_GA4_ID)

Jour 5 : Déploiement & Tests
- [ ] Sync vers 11 sites (scripts/sync-components.sh)
- [ ] Push vers GitHub (11 sites)
- [ ] Attendre rebuilds CapRover
- [ ] Tester events (GA4 DebugView)
- [ ] Valider données en temps réel

Résultat : Données GA4 qui arrivent ✅
```

**Estimation** : 1 semaine (5 jours)

### PHASE 2 : GSC & BigQuery (Semaines 2-3)

**Objectif** : Centraliser données SEO dans BigQuery

**Tâches** :
```
Semaine 2 : Configuration GSC + ETL
- [ ] Vérifier 11 domaines dans GSC
- [ ] Créer service account Google Cloud
- [ ] Activer API Search Console
- [ ] Créer projet BigQuery
- [ ] Définir schéma tables (gsc_global, gsc_pages, gsc_queries)
- [ ] Coder ETL quotidien (Node.js)
  - Authentification OAuth
  - Fetch GSC data (11 sites)
  - Insert BigQuery
  - Gestion erreurs & retries
- [ ] Déployer ETL (Cloud Function ou cron CapRover)
- [ ] Tester extraction J-1

Semaine 3 : Web Vitals + Leads
- [ ] Intégrer web-vitals library
- [ ] Créer endpoint POST /api/vitals
- [ ] Créer table web_vitals BigQuery
- [ ] Agréger Web Vitals quotidiennement
- [ ] Sync leads PostgreSQL → BigQuery
- [ ] Créer table leads BigQuery
- [ ] Tester pipeline complet

Résultat : BigQuery opérationnel avec 5 tables ✅
```

**Estimation** : 2 semaines

### PHASE 3 : Dashboard Looker Studio (Semaine 4)

**Objectif** : Visualiser les données consolidées

**Tâches** :
```
- [ ] Créer rapport Looker Studio
- [ ] Connecter BigQuery comme source
- [ ] Page 1 : Vue Globale
  - KPIs multi-sites
  - Tendances 90j
  - Comparaison inter-villes
  - Top pages/requêtes
- [ ] Page 2 : Vue Détail Site
  - Sélecteur ville
  - KPIs SEO ville
  - Entonnoir conversion
  - Web Vitals
- [ ] Page 3 : Alertes
  - Liste anomalies
  - Graphiques problématiques
- [ ] Tests & ajustements
- [ ] Partage avec équipe

Résultat : Dashboard opérationnel ✅
```

**Estimation** : 1 semaine

### PHASE 4 : Agents IA (Semaines 5-8+)

**Objectif** : Automatiser analyses & décisions

**Tâches** :
```
Semaine 5-6 : Infrastructure IA
- [ ] Créer API interne /api/ai/*
- [ ] Intégrer OpenAI API (GPT-4)
- [ ] Coder wrapper BigQuery → GPT
- [ ] Créer Agent SEO Optimizer
- [ ] Tests sur 2-3 sites pilotes

Semaine 7 : Agents supplémentaires
- [ ] Agent Content Strategist
- [ ] Agent CRO Optimizer
- [ ] Agent Report Generator
- [ ] Orchestrateur principal

Semaine 8+ : Raffinement & Automation
- [ ] Améliorer prompts (fine-tuning)
- [ ] Ajouter actions automatiques (optionnel)
- [ ] Dashboard agents (/admin/ai)
- [ ] Monitoring & logs
- [ ] Documentation

Résultat : Pilotage semi-automatique ✅
```

**Estimation** : 1 mois (évolutif)

---

## 💰 BUDGET DÉTAILLÉ

### Outils (mensuel)

| Outil | Coût | Justification |
|-------|------|---------------|
| **Google Analytics 4** | 0€ | Gratuit |
| **Google Search Console** | 0€ | Gratuit |
| **BigQuery** | 0-20€ | <10GB gratuit, puis ~5€/TB query |
| **Cloud Functions** | 0-10€ | 2M invocations gratuites/mois |
| **Looker Studio** | 0€ | Gratuit |
| **OpenAI API (GPT-4)** | 50-150€ | 10-30 requêtes/jour (~0.02€/requête) |
| **CMP (Axeptio)** | 0-50€ | Optionnel si RGPD strict |
| **Total** | **50-230€/mois** | |

### Temps de développement (one-time)

| Phase | Temps | Équivalent € (si freelance) |
|-------|-------|---------------------------|
| Phase 1 (GA4) | 5 jours | ~2 500€ |
| Phase 2 (BigQuery ETL) | 10 jours | ~5 000€ |
| Phase 3 (Dashboard) | 5 jours | ~2 500€ |
| Phase 4 (Agents IA) | 15 jours | ~7 500€ |
| **Total** | **35 jours** | **~17 500€** |

**Note** : Vous le faites vous-même → coût = temps uniquement

---

## ✅ CONFORMITÉ RGPD

### Stratégie Consent

**Option A : Consent Mode v2 (recommandé)**
```javascript
// Consentement par défaut = refusé
gtag('consent', 'default', {
  'analytics_storage': 'denied',
  'ad_storage': 'denied'
})

// Après acceptation utilisateur
gtag('consent', 'update', {
  'analytics_storage': 'granted'
})
```

**Option B : First-party fallback**
- Si refus consent → collecte first-party minimale (sans cookie)
- Events essentiels uniquement (page_view, conversions)
- Agrégation immédiate (pas de stockage individuel)

### Mise en conformité

**Checklist** :
- [ ] Bannière consentement (Axeptio ou custom)
- [ ] Politique de confidentialité mise à jour
- [ ] Mention finalités analytics
- [ ] Durée de rétention (18-24 mois)
- [ ] Droit d'accès / suppression (formulaire)
- [ ] Registre des traitements (RGPD)

---

## 🚀 DÉMARRAGE IMMÉDIAT

### Ce que je peux coder MAINTENANT

Si tu valides ce plan, je peux créer les fichiers suivants **dans les 30 prochaines minutes** :

```
Phase 1 - Fichiers prêts à déployer :

1. lib/analytics/ga4.ts
   - Config GA4
   - Helper functions
   
2. lib/analytics/gtag.ts
   - Wrapper gtag
   - Events tracking
   
3. app/ga-listener.tsx
   - Client component
   - Page view tracking
   
4. app/layout.tsx (modifications)
   - Injection scripts GA4
   
5. components/StickyCTA.tsx (modifications)
   - Ajout event cta_click
   
6. components/LeadForm.tsx (modifications)
   - Events form_start, form_submit
   
7. .env.example
   - Variables GA4
   
8. scripts/gsc-etl/
   - ETL GSC → BigQuery (Node.js)
   - README détaillé
```

**Après :** Sync vers 11 sites + déploiement = **tracking opérationnel en 3 heures**

---

## 📞 PROCHAINES ÉTAPES

### Option 1 : Je code Phase 1 maintenant ✨

**Tu dis "go"** → je crée les 8 fichiers ci-dessus en 30 min

### Option 2 : On affine le plan d'abord

**Questions à clarifier** :
- Budget OpenAI API ok pour Phase 4 ?
- Préférence BigQuery vs PostgreSQL local ?
- CMP (Axeptio) ou consent custom ?

### Option 3 : Documents complémentaires

**Je peux créer** :
- Guide configuration GA4 (screenshots)
- Tutorial ETL GSC (step-by-step)
- Spécifications agents IA (détails prompts)

---

## 🎯 CONCLUSION

Cette approche hybride **GA4 + BigQuery + IA** est :

✅ **Pragmatique** : Résultats en 1 semaine (Phase 1)  
✅ **Évolutive** : Agents IA progressifs  
✅ **Souveraine** : Données dans BigQuery (control total)  
✅ **Économique** : <100€/mois (hors OpenAI)  
✅ **Future-proof** : IA-ready dès le départ  
✅ **Conforme** : RGPD by design  

**Elle répond à 100% de vos objectifs** :
- ✅ Mesure indexation & visibilité SEO (GSC)
- ✅ Track conversions (GA4 + custom events)
- ✅ Multi-sites natif (11 domaines)
- ✅ Vision IA long terme (BigQuery + agents)

---

**Question finale : On démarre Phase 1 ?** 🚀


