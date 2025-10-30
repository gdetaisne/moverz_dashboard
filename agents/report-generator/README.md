# 📊 Agent Report Generator

**Génération automatique de rapports hebdomadaires multi-sites**

---

## 🎯 Fonctionnalités

### V1 (actuelle)

✅ **Rapport global unique** couvrant les 11 sites  
✅ **Analyse 14 derniers jours** (GSC data)  
✅ **Identification Winners/Losers** (top 3 de chaque)  
✅ **3-7 actions prioritaires** avec impact estimé  
✅ **Score de sévérité** (0-1) avec garde-fous  
✅ **Export Markdown** complet  
✅ **Sauvegarde BigQuery** (agent_insights)  
✅ **Push Slack** automatique (si configuré)  
✅ **Validation Zod** des retours GPT  

### V2 (prévue)

⏳ Rapports par site (optionnel)  
⏳ Export PDF  
⏳ Envoi Email automatique  
⏳ Comparaison mois/mois  
⏳ Intégration données GA4 (conversion funnel)  

---

## 🚀 Usage

### Lancement manuel

```bash
# Via npm script
npm run agent:report

# Via tsx direct
npx tsx agents/report-generator/agent.ts

# Via orchestrateur (lance tous les agents)
npm run agents:run
```

### Cron CapRover (hebdomadaire)

```bash
# Configuration (voir CRON-CAPROVER.md)
Schedule: 0 10 * * MON  # Tous les lundis à 10h
Command: npm run agent:report
```

---

## 📥 Données analysées

### Sources BigQuery

1. **GSC Summary (14j)** - `getGSCSummary({ startDate: '14 DAY' })`
   - Impressions/clics par site
   - CTR et position moyennes

2. **Visibility Trends (14j)** - `getVisibilityTrends({ startDate: '14 DAY' })`
   - Évolution semaine vs précédente
   - Identifie winners/losers

3. **Top Pages (10)** - `getTopPages({ limit: 10 })`
   - Pages les plus performantes
   - Détecte opportunités faible CTR

4. **Top Queries (30)** - `getTopQueries({ limit: 30 })`
   - Requêtes à fort volume
   - Mots-clés prioritaires

5. **Recent Insights (7j)** - `getLatestInsights({ days: 7 })`
   - Insights des autres agents (Traffic, SEO, Content)
   - Max 20 insights récents

---

## 📤 Output

### 1. JSON validé (Zod)

```typescript
{
  summary: string,           // 50-500 chars
  actions_top: Action[],     // 3-7 actions
  report_md: string,         // Markdown complet (≥200 chars)
  severity: 'info' | 'warn' | 'critical',
  score: number              // 0-1
}
```

### 2. BigQuery (agent_insights)

```sql
INSERT INTO analytics_core.agent_insights (
  id,
  run_date,
  site,              -- '*global*'
  agent,             -- 'report'
  severity,          -- 'info' | 'warn' | 'critical'
  title,
  summary,
  payload,           -- { report_md, period, network_summary }
  evidence,          -- { winners, losers }
  suggested_actions, -- [{priority, title, site, impact}]
  score
)
```

### 3. Slack (optionnel)

Message formaté avec blocks :
- Header : "📊 Rapport hebdo Moverz Analytics"
- Summary exécutif
- Top 3 actions recommandées
- Lien vers détails complets

---

## 🛡️ Garde-fous

### 1. Trafic minimum

**Règle :** Si `total_impressions < 3000` → downgrade à `severity=info`

**Raison :** Trafic trop faible pour être statistiquement significatif

```typescript
if (totalImpressions < 3000) {
  severity = 'info'
  reason = 'Trafic trop faible (<3000 imp/sem)'
}
```

### 2. Variation minimum

**Règle :** Si `|variation| < 5%` → downgrade à `severity=info`

**Raison :** Pas d'appel IA si aucune variation significative

```typescript
if (Math.abs(avgVariation) < 5) {
  severity = 'info'
  reason = 'Aucune variation significative (±5%)'
}
```

### 3. Validation Zod

**Tous les retours GPT sont validés :**
- `summary` : 50-500 chars
- `actions_top` : 3-7 items minimum
- `report_md` : ≥200 chars
- `severity` : enum strict
- `score` : 0-1 float

**Si validation échoue → agent status = 'failed'**

---

## 🔧 Configuration

### Variables d'environnement requises

```bash
# OpenAI (obligatoire)
OPENAI_API_KEY=sk-proj-xxxxx
OPENAI_MODEL=gpt-4-turbo-preview

# BigQuery (obligatoire)
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json

# Slack (optionnel mais recommandé)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz

# Dashboard (optionnel, pour lien dans Slack)
DASHBOARD_URL=https://analytics.moverz.io
```

---

## 💰 Coûts

**Modèle :** GPT-4 Turbo Preview

**Tokens/run :**
- Input : ~3-4K tokens (context)
- Output : ~2-3K tokens (rapport)
- **Total : ~6-8K tokens**

**Coût/run :** ~$0.15-0.20

**Fréquence :** 4x/mois (hebdo)

**Coût mensuel :** ~$0.60-0.80

---

## 🧪 Tests

### Test local

```bash
# 1. Configurer .env
cp .env.example .env
# Ajouter OPENAI_API_KEY

# 2. Lancer le rapport
npm run agent:report

# 3. Vérifier les outputs
# → Console : summary + actions
# → BigQuery : agent_runs + agent_insights
# → Slack (si configuré) : message reçu
```

### Tests d'acceptation

```bash
# Vérifier agent_runs
SELECT * FROM `moverz-dashboard.analytics_core.agent_runs`
WHERE agent_name = 'report-generator'
ORDER BY executed_at DESC
LIMIT 1

# Attendu :
# - status = 'success'
# - duration_seconds < 30
# - data contient { summary, actions, report_md, severity, score }

# Vérifier agent_insights
SELECT * FROM `moverz-dashboard.analytics_core.agent_insights`
WHERE agent = 'report' AND site = '*global*'
ORDER BY run_date DESC
LIMIT 1

# Attendu :
# - severity IN ('info', 'warn', 'critical')
# - score BETWEEN 0 AND 1
# - suggested_actions IS NOT NULL (JSON array)
# - payload contient report_md (Markdown)
```

---

## 📊 Exemple de rapport

```markdown
# 📊 Rapport Hebdomadaire - Semaine 44

## 🎯 Vue d'Ensemble

**Réseau Moverz (11 sites)**
- Impressions : 1,245,670 (+8.2% vs S-1)
- Clics : 45,234 (+12.5% vs S-1)
- CTR moyen : 3.63% (+0.4pp)
- Position moyenne : 8.2 (-0.3)

## 🏆 Top Performers

1. **Toulouse** - +18.5% impressions (meilleure progression)
2. **Marseille** - 12,540 clics (volume le plus élevé)
3. **Lyon** - CTR 4.2% (meilleur taux de conversion SERP)

## ⚠️ Alertes

- **Nice** - Baisse de 12% des impressions (à investiguer)
- **Rouen** - CTR en chute à 2.1% (-0.8pp)

## 💡 Actions Recommandées

### 1. [CRITICAL] Investiguer la chute de Nice
**Site :** nice  
**Impact :** Perte estimée de 1,200 impressions/semaine  
**Action :** Vérifier robots.txt, sitemap, pénalités Search Console

### 2. [HIGH] Optimiser title page "/prix-demenagement"
**Site :** marseille  
**Impact :** +150 clics/mois  
**Action :** Ajouter "2025" et "gratuit" dans le title

### 3. [HIGH] Créer article "Déménagement Étudiant"
**Site :** toulouse  
**Impact :** +30 clics/mois  
**Action :** Rédiger guide complet avec budget, checklist, aides

## 📈 Tendances

- Le mot-clé "déménagement pas cher" gagne +22% impressions
- Les requêtes avec "2025" en croissance (+35%)
- Les recherches mobiles augmentent (+5pp part de trafic)
```

---

## 🐛 Troubleshooting

### Erreur : "Validation error"

**Cause :** GPT a retourné un JSON invalide

**Solution :**
```bash
# Vérifier les logs
caprover logs -a dd-dashboard | grep "Report Generator"

# Re-lancer avec plus de contexte
OPENAI_MODEL=gpt-4-turbo-preview npm run agent:report
```

### Erreur : "Insufficient data"

**Cause :** Moins de 3000 impressions sur 14 jours

**Solution :** Normal pour sites à faible trafic, le rapport sera généré avec `severity=info`

### Pas de push Slack

**Vérifier la configuration :**
```bash
echo $SLACK_WEBHOOK_URL
# Doit retourner : https://hooks.slack.com/...
```

---

## 🔗 Liens utiles

- [AGENTS-IA-STATUS.md](../../AGENTS-IA-STATUS.md) - Vue d'ensemble agents
- [CRON-CAPROVER.md](../../CRON-CAPROVER.md) - Configuration cron
- [BigQuery Schema](../../db/migrations/005_agent_tables.sql) - Tables agents

---

**Dernière mise à jour :** 30 Octobre 2025  
**Version :** 1.0.0

