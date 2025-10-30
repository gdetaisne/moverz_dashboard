# Agent Traffic Analyst

## 📊 Description

Agent IA qui analyse automatiquement les données de trafic (impressions/clics) stockées dans BigQuery après chaque mise à jour ETL.

## 🎯 Fonctionnalités

- Analyse automatique des tendances de trafic (7j, 30j)
- Détection d'opportunités SEO (pages faible CTR, requêtes à fort potentiel)
- Identification d'alertes (chutes de visibilité, anomalies)
- Insights personnalisés par site

## 🔄 Déclenchement

**Automatique** : Après chaque mise à jour ETL GSC (via `etl/scheduler.ts`)

```typescript
// Dans etl/scheduler.ts
if (result.status === 'success' || result.status === 'partial') {
  await runTrafficAnalyst()
}
```

## 📥 Données analysées

- `moverz.gsc_global` : Vue d'ensemble (impressions, clics, CTR, position)
- `moverz.gsc_pages` : Performance par page
- `moverz.gsc_queries` : Performance par requête
- Tendances 7j vs précédent

## 🧠 Prompt IA

L'agent utilise GPT-4 pour analyser les données et générer :
- **Trends** : Évolutions significatives
- **Opportunities** : Opportunités d'amélioration
- **Alerts** : Alertes importantes
- **Anomalies** : Comportements anormaux

## 📤 Format de sortie

```json
{
  "insights": [
    {
      "type": "trend" | "opportunity" | "alert" | "anomaly",
      "priority": "critical" | "high" | "medium" | "low",
      "site": "marseille",
      "metric": "impressions",
      "title": "Hausse forte du trafic",
      "description": "...",
      "data": {
        "current": 12345,
        "previous": 11234,
        "change": +9.9,
        "unit": "%"
      },
      "recommendation": "..."
    }
  ],
  "summary": "Résumé global",
  "highlights": ["Point 1", "Point 2", "Point 3"]
}
```

## 🚀 Usage

### Lancer manuellement

```bash
npx tsx agents/traffic-analyst/agent.ts
```

### Via orchestrateur

```bash
npm run agents:run
```

## 💰 Coûts OpenAI

- **Modèle** : GPT-4 Turbo Preview
- **Estimation** : ~5-8K tokens/run
- **Coût** : ~$0.10-0.16 par analyse
- **Fréquence** : Quotidienne après ETL

## 📊 Exemple de sortie

```
📊 Résultat Traffic Analyst:
  Status: success
  Duration: 8.5s
  Total insights: 12

📝 Summary: Le trafic global a augmenté de 12% cette semaine...

🎯 Highlights:
  1. Hausse de 15% des impressions sur Toulouse
  2. 3 pages à fort potentiel détectées (CTR <2% avec 1000+ impressions)
  3. Alerte : Baisse de 8% des clics sur Nice

💡 Top Insights:

  1. [TREND] Hausse forte du trafic sur Toulouse
     Site: toulouse
     Description: Les impressions ont augmenté de 15% cette semaine
     Données: 12540 vs 10920 (+14.9%)

  2. [OPPORTUNITY] Optimiser titre page /demenagement-pas-cher
     Site: marseille
     Description: CTR de 1.2% malgré 5800 impressions
     Données: 5800 impressions, CTR: 1.2% vs avg 2.5%
```

## 🔧 Configuration

Variables d'environnement requises :
- `OPENAI_API_KEY` : Clé API OpenAI
- `GCP_PROJECT_ID` : Projet GCP (BigQuery)
- `GOOGLE_APPLICATION_CREDENTIALS` : Credentials GCP

