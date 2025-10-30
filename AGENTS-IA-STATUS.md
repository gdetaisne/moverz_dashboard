# 🤖 Agents IA - État des lieux complet

**Date:** 30 Octobre 2025  
**Version:** 1.0.0

---

## 📋 Table des matières

1. [Infrastructure de base](#infrastructure-de-base)
2. [Agents opérationnels](#agents-opérationnels)
3. [Agents prévus](#agents-prévus)
4. [Orchestrateur](#orchestrateur)
5. [ChatBot Dashboard](#chatbot-dashboard)
6. [Coûts OpenAI](#coûts-openai)
7. [Configuration](#configuration)
8. [Résumé et prochaines étapes](#résumé-et-prochaines-étapes)

---

## 🏗️ Infrastructure de base

### Fichiers core ✅

**`agents/core/types.ts`** - Types partagés
```typescript
interface AgentResult {
  agentName: string
  executedAt: Date
  duration: number
  status: 'success' | 'failed'
  data: any
  error?: string
}

interface Action {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  site: string
  category: 'seo' | 'content' | 'cro' | 'technical'
  title: string
  description: string
  estimatedImpact: string
  estimatedEffort: string
  deadline?: Date
  completed: boolean
}

interface Insight {
  id: string
  agentName: string
  createdAt: Date
  site: string
  metric: string
  observation: string
  recommendation: string
  confidence: number // 0-1
}
```

**`agents/core/orchestrator.ts`** - Chef d'orchestre
- Exécute séquentiellement tous les agents
- Logging complet
- Gestion d'erreurs par agent
- Stats finales (success/failed)

**`agents/shared/openai-client.ts`** - Wrapper OpenAI API
```typescript
export async function chat(
  systemPrompt: string,
  userMessage: string,
  options?: { model?, temperature?, maxTokens? }
): Promise<string>

export async function chatWithJSON<T>(
  systemPrompt: string,
  userMessage: string,
  options?
): Promise<T>
```

**`agents/shared/bigquery-tools.ts`** - 10 fonctions SQL helpers

### Fonctions BigQuery disponibles

| Fonction | Description | Usage |
|----------|-------------|-------|
| `getGSCSummary()` | Métriques globales par site | Vue d'ensemble trafic |
| `getTopPages()` | Top pages par trafic | Identifier meilleures pages |
| `getLowCTRPages()` | Pages CTR <2%, >100 imp | Opportunités SEO |
| `getTopQueries()` | Top requêtes par volume | Mots-clés prioritaires |
| `getVisibilityTrends()` | Tendances 7j vs précédent | Détecter évolutions |
| `getTrafficComparison()` | Comparaison périodes | Analyse temporelle |
| `getConversionFunnel()` | Entonnoir conversion (GA4) | Analyse CRO |
| `getContentGaps()` | Gaps position >10 | Opportunités contenu |
| `getUnderperformingContent()` | Contenu sous-performant | Optimisations |
| `getWebVitalsPerformance()` | Performance LCP/FID/CLS | Santé technique |

---

## ✅ Agents opérationnels

### 1. Traffic Analyst 🚀 COMPLET

**Fichier:** `agents/traffic-analyst/agent.ts` + README.md

**Rôle:** Analyse automatique du trafic après chaque mise à jour ETL

**Fonctionnalités:**
- Détection de tendances (hausses/baisses significatives)
- Identification d'opportunités (pages faible CTR avec fort potentiel)
- Alertes (chutes de visibilité, anomalies)
- Insights personnalisés par site

**Données analysées:**
- Vue d'ensemble (impressions, clics, CTR, position) sur 30j
- Tendances 7j vs période précédente
- Pages à faible CTR (>100 impressions, CTR <2%)
- Top requêtes (30 derniers jours)
- Top pages par trafic

**Output:**
```json
{
  "insights": [
    {
      "type": "trend" | "opportunity" | "alert" | "anomaly",
      "priority": "critical" | "high" | "medium" | "low",
      "site": "marseille",
      "metric": "impressions",
      "title": "Hausse forte du trafic",
      "description": "Les impressions ont augmenté de 15% cette semaine",
      "data": {
        "current": 12345,
        "previous": 11234,
        "change": 9.9,
        "unit": "%"
      },
      "recommendation": "Capitaliser sur cette dynamique..."
    }
  ],
  "summary": "Le trafic global a augmenté de 12% cette semaine...",
  "highlights": [
    "Hausse de 15% des impressions sur Toulouse",
    "3 pages à fort potentiel détectées",
    "Alerte : Baisse de 8% des clics sur Nice"
  ]
}
```

**Déclenchement:**
- **Automatique:** Après chaque ETL GSC (via `etl/scheduler.ts`)
- **Manuel:** `npx tsx agents/traffic-analyst/agent.ts`

**Coût estimé:** ~$0.10-0.16 par run (GPT-4 Turbo, 5-8K tokens)

**Intégration:**
```typescript
// Dans etl/scheduler.ts
if (result.status === 'success' && process.env.OPENAI_API_KEY) {
  await runTrafficAnalyst()
}
```

---

### 2. SEO Optimizer 🔍 COMPLET

**Fichier:** `agents/seo-optimizer/agent.ts`

**Rôle:** Détecte opportunités et problèmes SEO

**Fonctionnalités:**
- Identifie pages avec fort potentiel (impressions élevées, CTR faible)
- Détecte chutes de visibilité anormales
- Trouve keywords à fort volume non exploités
- Propose optimisations concrètes (title, meta, contenu)

**Données analysées:**
- Pages à faible CTR (<2%) avec >100 impressions
- Tendances de visibilité (14 derniers jours)
- Top requêtes (50 premières)

**Output:**
```json
{
  "actions": [
    {
      "priority": "high",
      "site": "marseille",
      "title": "Optimiser title page prix déménagement",
      "description": "Ajouter '2025' et 'gratuit' dans le title",
      "estimatedImpact": "+150 clics/mois",
      "estimatedEffort": "Faible",
      "category": "title-optimization"
    }
  ],
  "summary": "5 opportunités SEO identifiées avec impact total estimé à +500 clics/mois"
}
```

**Déclenchement:**
- **Manuel:** `cd agents/seo-optimizer && tsx agent.ts`
- **Via orchestrateur:** `npm run agents:run`

**Coût estimé:** ~$0.10 par run (GPT-4 Turbo)

---

### 3. Content Strategist 📝 COMPLET

**Fichier:** `agents/content-strategist/agent.ts`

**Rôle:** Analyse performance contenu et suggère articles

**Fonctionnalités:**
- Identifie gaps de contenu (requêtes sans article)
- Analyse articles sous-performants
- Détecte opportunités longue traîne
- Repère cannibalisation de contenu

**Données analysées:**
- Gaps de contenu (requêtes position >10 avec >50 impressions)
- Contenu sous-performant (CTR <1.5% OU position >20)
- Top requêtes (30 derniers jours)

**Output:**
```json
{
  "content_gaps": [
    {
      "priority": "high",
      "site": "toulouse",
      "title": "Déménagement Étudiant Toulouse - Guide Complet 2025",
      "query": "déménagement étudiant toulouse",
      "description": "Article complet couvrant: budget étudiant, aides financières, checklist...",
      "estimatedTraffic": "+30 clics/mois",
      "effort": "Moyen",
      "category": "satellite"
    }
  ],
  "optimizations": [
    {
      "priority": "medium",
      "site": "marseille",
      "url": "/blog/prix-demenagement-marseille",
      "issue": "CTR faible (1.2%) malgré 5800 impressions",
      "recommendation": "Réécrire meta description + ajouter FAQ structurée"
    }
  ],
  "summary": "10 nouveaux articles à créer, 5 optimisations prioritaires"
}
```

**Déclenchement:**
- **Manuel:** `cd agents/content-strategist && tsx agent.ts`
- **Via orchestrateur:** Hebdomadaire (prévu)

**Coût estimé:** ~$0.16 par run

---

### 4. ChatBot IA (Dashboard) 💬 COMPLET

**Fichiers:**
- `dashboard/app/api/chat/route.ts` - API endpoint
- `dashboard/components/ChatBot.tsx` - Interface utilisateur

**Rôle:** Interface conversationnelle pour interroger BigQuery

**Fonctionnalités:**
- Génère requêtes SQL via GPT-4 depuis questions en langage naturel
- Exécute les requêtes sur BigQuery
- Analyse les résultats et les explique en français
- Interface chat flottante dans le dashboard

**Exemples de questions:**
- "Quels sites ont le plus d'impressions cette semaine ?"
- "Quelle est la tendance des clics pour Marseille ?"
- "Montre-moi les 10 pages les plus performantes"
- "Compare les performances de Toulouse et Lyon"

**Prompt système:**
```
Tu es un expert SQL pour BigQuery analysant les données Google Search Console.

BASE DE DONNÉES:
- Table: moverz-dashboard.analytics_core.gsc_daily_aggregated
- Colonnes: date, domain, clicks, impressions, ctr, position

TÂCHE: Générer JSON avec { sql, explanation, suggestions }

RÈGLES:
- Nom de table exact
- Toujours filtrer sur date (DATE_SUB)
- LIMIT 100 max
- GROUP BY domain, date quand pertinent
```

**Output:**
```json
{
  "sql": "SELECT domain, SUM(impressions) as total FROM ... WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) GROUP BY domain ORDER BY total DESC",
  "explanation": "Cette requête calcule le total d'impressions par site sur 7 jours",
  "results": [...],
  "rowCount": 11,
  "analysis": "📊 Résumé\nMarseille domine avec 45,620 impressions (+12% vs semaine précédente)...",
  "suggestions": ["Analyser le CTR par site", "Voir l'évolution sur 30 jours"]
}
```

**Interface:**
- Bouton flottant en bas à droite
- Chat contextuel avec historique
- Affichage SQL + résultats en accordéon
- Analyse détaillée par GPT-4

**Coût estimé:** ~$0.08-0.10 par question (variable selon usage)

---

## 🚧 Agents prévus

### 5. CRO Optimizer ⏳

**Dossier:** `agents/cro-optimizer/` (vide)

**Rôle prévu:** Optimiser le taux de conversion

**Fonctionnalités prévues:**
- Analyser entonnoir page_view → cta_click → form_start → form_submit
- Identifier points de friction
- Suggérer tests A/B
- Optimiser CTA (position, wording, couleur)
- Analyser abandon formulaire

**Données requises:**
- GA4 BigQuery export (événements)
- Web Vitals (performance)
- Heatmaps (si disponible)

**Output prévu:**
```json
{
  "funnel_analysis": {
    "site": "marseille",
    "conversion_rate": 0.032,
    "bottlenecks": [
      {
        "step": "form_start → form_submit",
        "drop_rate": 0.68,
        "issue": "Formulaire trop long (12 champs)"
      }
    ]
  },
  "ab_tests": [
    {
      "hypothesis": "Réduire formulaire à 5 champs essentiels",
      "expected_lift": "+25% completion rate",
      "priority": "high"
    }
  ]
}
```

**Fréquence prévue:** Hebdomadaire (mercredi 10:00)

**Coût estimé:** ~$0.08 par run

---

### 6. Report Generator 📊 ⏳

**Dossier:** `agents/report-generator/` (vide)

**Rôle prévu:** Générer rapports hebdomadaires automatiques

**Fonctionnalités prévues:**
- Résumé KPIs de la semaine (évolution vs semaine précédente)
- Highlights par ville (3 meilleurs/pires performers)
- Tendances détectées (hausses/baisses significatives)
- Top insights des agents (Traffic, SEO, Content)
- Actions recommandées priorisées
- Format Markdown + envoi Email

**Output prévu:**
```markdown
# 📊 Rapport Hebdomadaire - Semaine 44 (30 Oct - 5 Nov 2025)

## 🎯 Vue d'Ensemble

**Réseau Moverz (11 sites)**
- Impressions: 1,245,670 (+8.2% vs S-1)
- Clics: 45,234 (+12.5% vs S-1)
- CTR moyen: 3.63% (+0.4pp)
- Position moyenne: 8.2 (-0.3)

## 🏆 Top Performers

1. **Toulouse** - +18.5% clics (meilleure progression)
2. **Marseille** - 12,540 clics (volume le plus élevé)
3. **Lyon** - CTR 4.2% (meilleur taux de conversion SERP)

## ⚠️ Alertes

- **Nice** - Baisse de 12% des impressions (à investiguer)
- **Rouen** - CTR en chute à 2.1% (-0.8pp)

## 💡 Actions Recommandées (Top 5)

1. [CRITICAL] Investiguer la chute de Nice
2. [HIGH] Optimiser title page "/prix-demenagement" sur Marseille
3. [HIGH] Créer article "Déménagement Étudiant" pour Toulouse
4. [MEDIUM] Améliorer meta descriptions Rouen
5. [MEDIUM] Tester nouveau CTA sur formulaire Lyon

## 📈 Tendances

- Le mot-clé "déménagement pas cher" gagne +22% impressions
- Les requêtes avec "2025" en croissance (+35%)
- Les recherches mobiles augmentent (+5pp part de trafic)
```

**Fréquence prévue:** Hebdomadaire (lundi 09:00)

**Envoi:** Email + sauvegarde BigQuery + export PDF

**Coût estimé:** ~$0.12 par run

---

### 7. Alerts Manager 🚨 ⏳

**Dossier:** `agents/alerts-manager/` (vide)

**Rôle prévu:** Surveillance continue et alertes en temps réel

**Fonctionnalités prévues:**
- Surveiller anomalies toutes les heures
- Alertes configurables par seuil
- Notifications Slack + Email
- Dashboard alertes actives

**Règles d'alertes prévues:**

| Règle | Seuil | Priorité | Action |
|-------|-------|----------|--------|
| Chute impressions | -30% sur 24h | Critical | Slack + Email immédiat |
| Chute clics | -25% sur 24h | High | Slack + Email |
| CTR faible | <1.5% sustained | Medium | Slack |
| Position dégradée | +5 positions sur 7j | Medium | Email hebdo |
| Performance LCP | >2.5s | High | Slack + Email |
| Erreurs 404 | +10 nouvelles | Medium | Email |

**Output prévu:**
```json
{
  "alerts": [
    {
      "id": "alert-20251030-001",
      "severity": "critical",
      "site": "nice",
      "metric": "impressions",
      "message": "Chute de 32% des impressions sur 24h",
      "data": {
        "current": 3420,
        "previous": 5029,
        "threshold": -30
      },
      "recommendations": [
        "Vérifier robots.txt",
        "Vérifier sitemap",
        "Vérifier Search Console pour pénalités"
      ],
      "notified": true,
      "notified_at": "2025-10-30T14:23:00Z",
      "resolved": false
    }
  ]
}
```

**Fréquence prévue:** Horaire (toutes les heures)

**Coût estimé:** ~$0.04 par run

**Optimisation coût:** Utiliser GPT-4o-mini au lieu de GPT-4 Turbo = -70% de coût (~$10/mois au lieu de $30)

---

## 🎯 Orchestrateur

**Fichier:** `agents/core/orchestrator.ts`

### État actuel

**Agents configurés:**
```typescript
const AGENTS = [
  {
    name: 'Traffic Analyst',
    fn: runTrafficAnalyst,
    schedule: 'daily',
  },
  {
    name: 'SEO Optimizer',
    fn: runSEOOptimizer,
    schedule: 'daily',
  },
  {
    name: 'Content Strategist',
    fn: runContentStrategist,
    schedule: 'weekly',
  },
  // TODO: CRO Optimizer, Report Generator, Alerts Manager
]
```

**Fonctionnement:**
1. Lance chaque agent séquentiellement
2. Capture résultats + durée + statut
3. Gère erreurs par agent (n'interrompt pas l'orchestrateur)
4. Log complet
5. Résumé final (X success, Y failed)

**Lancement:**
```bash
npm run agents:run
# ou
npx tsx agents/core/orchestrator.ts
```

### TODO

- [ ] Sauvegarder résultats dans BigQuery (table `agent_runs`)
- [ ] Envoyer notifications si agents critiques échouent
- [ ] Ajouter les 3 agents manquants (CRO, Report, Alerts)
- [ ] Système de retry pour erreurs transitoires
- [ ] Dashboard de monitoring des agents

**Structure table `agent_runs` prévue:**
```sql
CREATE TABLE analytics_core.agent_runs (
  id STRING,
  agent_name STRING,
  executed_at TIMESTAMP,
  duration_seconds FLOAT64,
  status STRING, -- 'success' | 'failed'
  data JSON,
  error STRING,
  created_at TIMESTAMP
)
PARTITION BY DATE(executed_at)
CLUSTER BY agent_name, status
```

---

## 💰 Coûts OpenAI

### Coûts actuels (agents opérationnels)

| Agent | Fréquence | Tokens/run | Coût/run | Coût/mois |
|-------|-----------|------------|----------|-----------|
| **Traffic Analyst** | Quotidien | 5-8K | $0.10-0.16 | ~$3-5 |
| **SEO Optimizer** | Quotidien | ~5K | $0.10 | ~$3 |
| **Content Strategist** | Hebdo | ~8K | $0.16 | ~$0.70 |
| **ChatBot** | À la demande | 3-5K | $0.08-0.10 | Variable (~$5-10) |
| **SOUS-TOTAL** | | | | **~$12-19/mois** |

### Coûts prévus (agents à implémenter)

| Agent | Fréquence | Tokens/run | Coût/run | Coût/mois |
|-------|-----------|------------|----------|-----------|
| CRO Optimizer | Hebdo | ~4K | $0.08 | ~$0.35 |
| Report Generator | Hebdo | ~6K | $0.12 | ~$0.50 |
| Alerts Manager | Horaire (24x7) | ~2K | $0.04 | ~$30 |
| **SOUS-TOTAL** | | | | **~$31/mois** |

### Total estimé

**Coût total agents IA: ~$43-50/mois**

### Optimisations possibles

1. **Utiliser GPT-4o-mini pour Alerts Manager**
   - Coût: ~$10/mois au lieu de $30
   - Économie: -$20/mois
   - **Nouveau total: ~$23-30/mois**

2. **Caching des requêtes BigQuery**
   - Éviter requêtes répétées dans la même heure
   - Économie tokens: -20%

3. **Batching des analyses**
   - Grouper plusieurs sites dans une seule requête GPT
   - Économie tokens: -30%

### Tarification OpenAI (référence)

**GPT-4 Turbo Preview**
- Input: $0.01 / 1K tokens
- Output: $0.03 / 1K tokens

**GPT-4o-mini**
- Input: $0.00015 / 1K tokens
- Output: $0.0006 / 1K tokens
- **~70% moins cher que GPT-4 Turbo**

---

## 🔧 Configuration

### Variables d'environnement requises

```bash
# OpenAI (obligatoire pour agents IA)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4-turbo-preview  # ou gpt-4o-mini

# BigQuery (déjà configuré)
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GOOGLE_APPLICATION_CREDENTIALS=/app/sa-key.json

# Sites (déjà configuré)
SITES_LIST=devis-demenageur-marseille.fr,...

# Notifications (optionnel - Phase 4)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
ALERT_EMAIL_TO=guillaume@moverz.io
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@moverz.io
SMTP_PASSWORD=xxxxx
```

### Activation dans CapRover

**Ajouter dans les variables d'environnement:**
```
OPENAI_API_KEY=sk-proj-...
```

**L'orchestrateur est déjà intégré dans le scheduler:**
```typescript
// etl/scheduler.ts
// Traffic Analyst se lance automatiquement après ETL GSC
if (result.status === 'success' && process.env.OPENAI_API_KEY) {
  await runTrafficAnalyst()
}
```

**Pour lancer manuellement tous les agents:**
```bash
npm run agents:run
```

---

## 📊 Résumé et prochaines étapes

### État actuel ✅

**Opérationnels (4 composants):**
1. ✅ Traffic Analyst - Analyse automatique quotidienne
2. ✅ SEO Optimizer - Opportunités SEO
3. ✅ Content Strategist - Stratégie de contenu
4. ✅ ChatBot Dashboard - Interface conversationnelle

**Infrastructure complète:**
- ✅ Orchestrateur fonctionnel
- ✅ 10 fonctions BigQuery helpers
- ✅ Wrapper OpenAI avec gestion JSON
- ✅ Types et logs structurés
- ✅ Intégration ETL scheduler

### À implémenter ⏳

**Agents (3 restants):**
1. ⏳ CRO Optimizer - Optimisation conversion
2. ⏳ Report Generator - Rapports hebdomadaires
3. ⏳ Alerts Manager - Surveillance continue

**Infrastructure:**
- ⏳ Sauvegarde résultats dans BigQuery (`agent_runs`)
- ⏳ Notifications Slack/Email
- ⏳ Dashboard monitoring agents
- ⏳ Système de retry

### Recommandations prioritaires

**Court terme (1-2 semaines):**
1. **Implémenter Report Generator**
   - Le plus utile pour avoir des rapports hebdo automatiques
   - Coût faible (~$0.50/mois)
   - Format Email + Markdown prêt

2. **Ajouter sauvegarde BigQuery**
   - Historique des analyses agents
   - Traçabilité et audit
   - Facilite le dashboard monitoring

**Moyen terme (3-4 semaines):**
3. **Implémenter Alerts Manager (version GPT-4o-mini)**
   - Surveillance continue
   - Coût optimisé (~$10/mois)
   - Notifications Slack

4. **Implémenter CRO Optimizer**
   - Nécessite GA4 BigQuery export configuré
   - Analyse entonnoir conversion
   - Tests A/B suggérés

**Long terme (1-2 mois):**
5. **Dashboard monitoring agents**
   - Interface web pour voir historique runs
   - Visualisation insights
   - Gestion alertes actives

6. **Optimisations avancées**
   - Caching intelligent
   - Batching analyses
   - Fine-tuning prompts

### Budget final estimé

**Avec optimisations:**
- Agents actuels: ~$12-19/mois
- Nouveaux agents (optimisés): ~$11/mois
- **Total: ~$23-30/mois**

**ROI estimé:**
- Traffic Analyst: Détection automatique opportunités (+5-10% trafic)
- SEO Optimizer: Actions priorisées (gain temps: 4-6h/semaine)
- Report Generator: Rapports automatiques (gain temps: 2h/semaine)
- **Gain temps total: ~6-8h/semaine = ~25-35h/mois**
- **Valeur temps économisé: ~1 250-1 750€/mois à 50€/h**

**ROI: x40-60** 🎯

---

**Dernière mise à jour:** 30 Octobre 2025  
**Mainteneur:** Guillaume Stehelin (guillaume@moverz.io)

