# 🤖 Agents IA - Intelligence Automatisée

Agents autonomes d'analyse et d'optimisation via OpenAI GPT-4.

## 📁 Structure

```
agents/
├── core/
│   ├── orchestrator.ts      # Chef d'orchestre
│   ├── base-agent.ts        # Classe parente
│   └── types.ts             # Types partagés
├── seo-optimizer/
│   ├── agent.ts             # Agent optimisation SEO
│   ├── prompts.ts           # Prompts système
│   └── actions.ts           # Actions disponibles
├── content-strategist/
│   ├── agent.ts             # Agent stratégie contenu
│   ├── prompts.ts
│   └── actions.ts
├── cro-optimizer/
│   ├── agent.ts             # Agent optimisation conversion
│   └── prompts.ts
├── report-generator/
│   ├── agent.ts             # Agent rapports automatiques
│   └── templates/           # Templates Markdown
├── alerts-manager/
│   ├── agent.ts             # Agent surveillance & alertes
│   └── rules.ts             # Règles d'alertes
└── shared/
    ├── bigquery-tools.ts    # Accès données BigQuery
    ├── openai-client.ts     # Wrapper OpenAI API
    └── logger.ts            # Logging structuré
```

## 🎯 Agents disponibles

### 1. SEO Optimizer
**Rôle** : Détecter opportunités & problèmes SEO

**Analyses** :
- Pages fort potentiel (impressions élevées, CTR faible)
- Chutes de visibilité anormales
- Keywords à fort volume non exploités
- Optimisations title/meta

**Output** : Liste d'actions priorisées avec impact estimé

### 2. Content Strategist
**Rôle** : Analyser performance contenu & suggérer articles

**Analyses** :
- Gaps de contenu (requêtes sans article)
- Articles sous-performants
- Opportunités longue traîne
- Cannibalisation de contenu

**Output** : Briefs d'articles à créer

### 3. CRO Optimizer
**Rôle** : Optimiser le taux de conversion

**Analyses** :
- Entonnoir page_view → lead_submit
- Points de friction
- Tests A/B suggérés
- Optimisations CTA

**Output** : Recommandations d'optimisation

### 4. Report Generator
**Rôle** : Générer rapports hebdomadaires automatiques

**Contenu** :
- Résumé semaine (KPIs)
- Highlights par ville
- Tendances & insights
- Actions recommandées

**Output** : Rapport Markdown + Email

### 5. Alerts Manager
**Rôle** : Surveiller & notifier anomalies

**Surveillance** :
- Chutes de visibilité >30%
- CTR faible <1.5%
- Performance dégradée (LCP >2.5s)
- Abandon formulaire >60%

**Output** : Notifications Slack/Email

## 🚀 Usage

### Lancer l'orchestrateur

```bash
# Lance tous les agents (analyse quotidienne)
npm run agents:run
```

### Lancer un agent spécifique

```typescript
import { SEOOptimizer } from './seo-optimizer/agent'

const agent = new SEOOptimizer()
const results = await agent.analyze({
  period: '7d',
  sites: ['marseille', 'toulouse']
})

console.log(results.actions)
```

## ⏰ Planning

| Agent | Fréquence | Heure | Durée |
|-------|-----------|-------|-------|
| SEO Optimizer | Quotidien | 12:00 | ~5 min |
| Content Strategist | Hebdo (Lundi) | 10:00 | ~10 min |
| CRO Optimizer | Hebdo (Mercredi) | 10:00 | ~5 min |
| Report Generator | Hebdo (Lundi) | 09:00 | ~3 min |
| Alerts Manager | Toutes les heures | XX:00 | ~1 min |

## 🔐 Variables d'environnement

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4-turbo-preview

# BigQuery (accès données)
GCP_PROJECT_ID=moverz-analytics
GOOGLE_SERVICE_ACCOUNT_KEY=...

# Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
ALERT_EMAIL_TO=guillaume@moverz.io
```

## 📊 Coûts OpenAI estimés

**GPT-4 Turbo** : $0.01 / 1K tokens input, $0.03 / 1K tokens output

| Agent | Tokens/run | Coût/run | Fréquence | Coût/mois |
|-------|------------|----------|-----------|-----------|
| SEO Optimizer | ~5K | $0.10 | Quotidien | $3 |
| Content Strategist | ~8K | $0.16 | Hebdo | $0.70 |
| CRO Optimizer | ~4K | $0.08 | Hebdo | $0.35 |
| Report Generator | ~6K | $0.12 | Hebdo | $0.50 |
| Alerts Manager | ~2K | $0.04 | Horaire | $30 |
| **Total** | | | | **~$35/mois** |

**Optimisations possibles** :
- Utiliser GPT-4o-mini pour alertes simples (~70% moins cher)
- Cacher les résultats 1h (éviter re-calculs)
- Batching des analyses

## 🧪 Tests

```bash
# Tester un agent
npm run test agents/seo-optimizer/agent.test.ts

# Tester l'orchestrateur
npm run test agents/core/orchestrator.test.ts
```

## 📝 Exemples d'output

### SEO Optimizer
```json
{
  "actions": [
    {
      "priority": "high",
      "site": "marseille",
      "url": "/blog/prix-demenagement-marseille",
      "issue": "CTR faible (1.2%) malgré 5800 impressions",
      "recommendation": "Optimiser title : ajouter '2025' et 'gratuit'",
      "estimated_impact": "+150 clics/mois"
    }
  ]
}
```

### Content Strategist
```json
{
  "content_gaps": [
    {
      "city": "toulouse",
      "query": "déménagement étudiant toulouse",
      "monthly_searches": 880,
      "current_position": null,
      "recommendation": "Créer article satellite 'Déménagement Étudiant Toulouse'",
      "estimated_traffic": "+30 clics/mois"
    }
  ]
}
```

---

**Documentation complète** : `/docs/guides/agents-ia.md`

