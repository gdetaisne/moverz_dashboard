# ⚡ Quickstart Report Generator

**Guide étape par étape pour activer le Report Generator en production**

**Temps estimé:** 10-15 minutes

---

## ✅ Étape 1 : Appliquer la migration BigQuery (2 min)

### Via bq CLI (recommandé)

```bash
# Se connecter à GCP
gcloud auth login
gcloud config set project moverz-dashboard

# Appliquer la migration
bq query --use_legacy_sql=false < db/migrations/005_agent_tables.sql

# Vérifier que les tables sont créées
bq ls analytics_core | grep agent_
```

**Attendu:**
```
agent_insights
agent_runs
```

### Via BigQuery Console (alternative)

1. Aller sur [BigQuery Console](https://console.cloud.google.com/bigquery)
2. Sélectionner projet `moverz-dashboard`
3. Ouvrir `db/migrations/005_agent_tables.sql`
4. Copier tout le contenu
5. Aller dans Query Editor
6. Coller et cliquer "Run"

---

## ✅ Étape 2 : Configurer les variables d'environnement (3 min)

### Dans CapRover UI

```
Apps → dd-dashboard → App Configs → Environment Variables
```

**Variables à ajouter (si manquantes) :**

```bash
# Déjà présentes normalement
OPENAI_API_KEY=sk-proj-xxxxx
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GOOGLE_APPLICATION_CREDENTIALS=/app/sa-key.json

# Nouvelles (recommandées)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
DASHBOARD_URL=https://analytics.moverz.io
```

**Sauvegarder** → CapRover va redémarrer l'app automatiquement

---

## ✅ Étape 3 : Test manuel local (2 min)

```bash
# Depuis ton terminal local
cd /Users/guillaumestehelin/moverz_dashboard-1

# Installer les dépendances (si pas déjà fait)
npm install

# Lancer le Report Generator
npm run agent:report
```

**Output attendu:**
```
🚀 Launching Report Generator...
📊 Starting Report Generator Agent...
Fetching GSC data (14 days)...
Generating report with GPT-4...
✅ Report Generator completed
   Status: success
   Duration: 8.5s
   Actions: 5
   Severity: info
   Score: 0.65

📝 Summary:
[Résumé généré par GPT]
```

**Si erreur :** Voir section Troubleshooting ci-dessous

---

## ✅ Étape 4 : Vérifier BigQuery (1 min)

```sql
-- Ouvrir BigQuery Console
-- Exécuter ces requêtes

-- 1. Vérifier agent_runs (doit avoir 1 ligne)
SELECT 
  id,
  agent_name,
  executed_at,
  status,
  duration_seconds
FROM `moverz-dashboard.analytics_core.agent_runs`
WHERE agent_name = 'report-generator'
ORDER BY executed_at DESC
LIMIT 1

-- 2. Vérifier agent_insights (doit avoir 1 rapport)
SELECT 
  id,
  run_date,
  site,
  agent,
  severity,
  title,
  score
FROM `moverz-dashboard.analytics_core.agent_insights`
WHERE agent = 'report' AND site = '*global*'
ORDER BY run_date DESC
LIMIT 1
```

**✅ Si les 2 requêtes retournent 1 ligne chacune → OK !**

---

## ✅ Étape 5 : Configurer le cron CapRover (2 min)

### Méthode CLI (recommandée)

```bash
# Se connecter
caprover login

# Ajouter le cron job
caprover cron add --app dd-dashboard \
  --schedule "0 10 * * MON" \
  --command "npm run agent:report"

# Vérifier qu'il est bien créé
caprover cron list --app dd-dashboard
```

**Attendu:**
```
report-generator  |  0 10 * * MON  |  npm run agent:report  |  enabled
```

### Méthode UI (alternative)

1. **Aller dans CapRover UI**
   ```
   Apps → dd-dashboard → App Configs → Persistent Apps
   ```

2. **Cliquer sur "Add Persistent App"**

3. **Remplir le formulaire:**
   ```
   Name: report-generator
   Schedule: 0 10 * * MON
   Command: npm run agent:report
   Timezone: Europe/Paris
   Enabled: ✓
   ```

4. **Sauvegarder**

---

## ✅ Étape 6 : Vérifier Slack (1 min)

**Si SLACK_WEBHOOK_URL est configuré :**

Tu devrais avoir reçu un message Slack lors du test manuel (Étape 3).

**Format attendu :**
```
📊 Rapport hebdo Moverz Analytics

[Résumé exécutif]

🎯 Top actions recommandées :
1. [Action 1] (site)
2. [Action 2] (site)
3. [Action 3] (site)

📈 Voir les détails complets
```

**Si pas de message :** Vérifier que le webhook est valide

```bash
# Tester le webhook
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test Report Generator"}'
```

---

## ✅ Étape 7 : Attendre le premier lundi (automatique)

**Le cron va se lancer automatiquement tous les lundis à 10h.**

**Prochain lundi :** [Calculer la date]

**Pour vérifier en temps réel:**
```bash
caprover logs -a dd-dashboard -f | grep "Report Generator"
```

---

## 🎯 Checklist finale

**Tout est OK si :**

- [x] Tables `agent_runs` et `agent_insights` existent dans BigQuery
- [x] Test manuel réussi (`npm run agent:report`)
- [x] 1 ligne dans `agent_runs` avec status='success'
- [x] 1 ligne dans `agent_insights` avec rapport complet
- [x] Message Slack reçu (si configuré)
- [x] Cron CapRover configuré (`0 10 * * MON`)
- [x] Variables d'env OK (OPENAI_API_KEY, etc.)

**✅ Si tout est coché → Le Report Generator est opérationnel !**

---

## 🐛 Troubleshooting

### Erreur : "Table not found: agent_runs"

**Cause :** Migration non appliquée

**Solution :**
```bash
bq query --use_legacy_sql=false < db/migrations/005_agent_tables.sql
```

---

### Erreur : "OpenAI API key not configured"

**Cause :** Variable d'environnement manquante

**Solution :**
```bash
# CapRover UI
Apps → dd-dashboard → Environment Variables
→ Ajouter : OPENAI_API_KEY=sk-proj-xxxxx
```

---

### Erreur : "Insufficient data (< 3000 impressions)"

**Cause :** Trafic trop faible sur 14 jours

**Solution :** C'est normal ! Le rapport sera généré avec `severity=info`

**Note :** Le garde-fou downgrade automatiquement la sévérité si le trafic est faible.

---

### Erreur : "Validation error: ZodError"

**Cause :** GPT a retourné un JSON invalide

**Solution :** Relancer, le script retry automatiquement. Si persiste après 3 tentatives, vérifier les logs.

---

### Pas de message Slack

**Vérifier le webhook :**
```bash
echo $SLACK_WEBHOOK_URL
# Doit retourner : https://hooks.slack.com/...

# Tester manuellement
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test"}'
```

---

### Le cron ne se lance pas

**Vérifier qu'il est bien enregistré :**
```bash
caprover cron list --app dd-dashboard
```

**Vérifier les logs le lundi à 10h :**
```bash
caprover logs -a dd-dashboard -f
# Attendre 10h00, devrait voir : "🚀 Launching Report Generator..."
```

---

## 📊 Commandes utiles

### Consulter les logs

```bash
# Logs en temps réel
caprover logs -a dd-dashboard -f

# Filtrer sur Report Generator
caprover logs -a dd-dashboard | grep "Report Generator"

# Dernières 100 lignes
caprover logs -a dd-dashboard --lines 100
```

### Requêtes BigQuery utiles

```sql
-- Stats agents (derniers 30 jours)
SELECT * FROM `moverz-dashboard.analytics_core.v_agent_stats`

-- Derniers insights
SELECT * FROM `moverz-dashboard.analytics_core.v_latest_insights`
LIMIT 10

-- Rapports Report Generator
SELECT 
  run_date,
  severity,
  title,
  score,
  JSON_EXTRACT(payload, '$.report_md') as report_md
FROM `moverz-dashboard.analytics_core.agent_insights`
WHERE agent = 'report'
ORDER BY run_date DESC
```

### Lancer manuellement tous les agents

```bash
npm run agents:run
# Lance : Traffic Analyst, SEO Optimizer, Content Strategist, Report Generator
```

---

## 📈 Monitoring

### Dashboard BigQuery (à créer)

**Créer une vue pour suivre les agents :**
```sql
CREATE OR REPLACE VIEW `moverz-dashboard.analytics_core.v_agent_monitoring` AS
SELECT 
  DATE(executed_at) as date,
  agent_name,
  COUNT(*) as total_runs,
  COUNTIF(status = 'success') as success_count,
  ROUND(AVG(duration_seconds), 2) as avg_duration,
  MAX(executed_at) as last_run
FROM `moverz-dashboard.analytics_core.agent_runs`
WHERE executed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY date, agent_name
ORDER BY date DESC, agent_name
```

---

## 🎉 C'est fait !

**Le Report Generator est maintenant actif.**

**Prochaines étapes :**
1. Attendre le premier lundi
2. Vérifier que le rapport est généré
3. Consulter dans BigQuery
4. Lire le message Slack

**ROI attendu :** x40-50 (2h/semaine économisées = ~100€/semaine vs ~$0.80/mois)

---

## 📚 Documentation

- **[IMPLEMENTATION-REPORT-GENERATOR.md](IMPLEMENTATION-REPORT-GENERATOR.md)** - Implémentation complète
- **[agents/report-generator/README.md](agents/report-generator/README.md)** - Doc de l'agent
- **[CRON-CAPROVER.md](CRON-CAPROVER.md)** - Guide cron détaillé
- **[AGENTS-IA-STATUS.md](AGENTS-IA-STATUS.md)** - Vue d'ensemble agents

---

**Questions ?** Consulte `IMPLEMENTATION-REPORT-GENERATOR.md` section Troubleshooting

**Dernière mise à jour :** 30 Octobre 2025

