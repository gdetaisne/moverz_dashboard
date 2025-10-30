# ⏰ Configuration Cron CapRover - Agents IA

**Guide pour planifier l'exécution automatique du Report Generator**

---

## 📋 Vue d'ensemble

Le **Report Generator** doit tourner **tous les lundis à 10h** (après l'ETL GSC quotidien).

---

## 🔧 Configuration CapRover

### Option 1 : CapRover CLI (recommandé)

```bash
# Se connecter à CapRover
caprover login

# Ajouter un cron job
caprover cron add --app dd-dashboard \
  --schedule "0 10 * * MON" \
  --command "npm run agent:report"
```

### Option 2 : CapRover UI

1. **Aller dans CapRover UI**
   - Apps → `dd-dashboard` → App Configs

2. **Ajouter un nouveau Cron Job**
   - Cliquer sur "Add Persistent App"
   - Type: **Persistent App (Cron)**

3. **Configuration**
   ```
   Name: report-generator
   Schedule: 0 10 * * MON
   Command: npm run agent:report
   Timezone: Europe/Paris
   ```

4. **Sauvegarder**

---

## 📅 Schedule Cron Expliqué

```
┌─────────── minute (0-59)
│ ┌───────── hour (0-23)
│ │ ┌─────── day of month (1-31)
│ │ │ ┌───── month (1-12)
│ │ │ │ ┌─── day of week (0-7, 0 et 7 = dimanche)
│ │ │ │ │
0 10 * * MON  → Tous les lundis à 10h00
```

**Exemples de schedules :**
```bash
0 9 * * *      # Tous les jours à 9h
0 10 * * MON   # Tous les lundis à 10h
0 0 1 * *      # Le 1er de chaque mois à minuit
*/30 * * * *   # Toutes les 30 minutes
```

---

## ✅ Vérifier que le cron fonctionne

### Via CapRover Logs

```bash
caprover logs -a dd-dashboard -f | grep "Report Generator"
```

**Output attendu (tous les lundis à 10h):**
```
🚀 Launching Report Generator...
⏰ Time: 2025-11-04T10:00:00.000Z
📊 Starting Report Generator Agent...
✅ Report Generator completed
   Status: success
   Duration: 8.5s
   Actions: 5
   Severity: info
   Score: 0.65
```

### Via BigQuery

```sql
-- Vérifier les runs du Report Generator
SELECT 
  agent_name,
  executed_at,
  status,
  duration_seconds
FROM `moverz-dashboard.analytics_core.agent_runs`
WHERE agent_name = 'report-generator'
ORDER BY executed_at DESC
LIMIT 10
```

### Via Slack

Si `SLACK_WEBHOOK_URL` est configuré, tu recevras un message chaque lundi avec le rapport.

---

## 🚨 Troubleshooting

### Le cron ne se lance pas

**Vérifier que le cron est bien enregistré :**
```bash
caprover cron list --app dd-dashboard
```

**Vérifier les variables d'environnement :**
- `OPENAI_API_KEY` → Requis
- `GCP_PROJECT_ID` → Requis
- `GOOGLE_APPLICATION_CREDENTIALS` → Requis
- `SLACK_WEBHOOK_URL` → Optionnel (mais recommandé)

### Le cron se lance mais échoue

**Consulter les logs d'erreur :**
```bash
caprover logs -a dd-dashboard --lines 100 | grep -A 10 "Report Generator"
```

**Erreurs fréquentes :**

1. **OpenAI API key not configured**
   ```bash
   # Ajouter dans CapRover UI
   OPENAI_API_KEY=sk-proj-xxxxx
   ```

2. **BigQuery table not found**
   ```bash
   # Appliquer la migration
   npm run db:migrate
   ```

3. **Insufficient data (< 3000 impressions)**
   - C'est normal si le trafic est faible
   - Le rapport sera généré avec `severity=info`

---

## 📊 Planning complet des agents

| Agent | Fréquence | Schedule Cron | Commande |
|-------|-----------|---------------|----------|
| **Traffic Analyst** | Quotidien (après ETL) | Automatique | Intégré dans `etl/scheduler.ts` |
| **Report Generator** | Hebdo (lundi) | `0 10 * * MON` | `npm run agent:report` |
| SEO Optimizer | À la demande | - | `npm run agents:run` |
| Content Strategist | À la demande | - | `npm run agents:run` |

**Note :** SEO Optimizer et Content Strategist peuvent être ajoutés au cron si besoin :
```bash
# SEO tous les jours à 11h
caprover cron add --app dd-dashboard --schedule "0 11 * * *" --command "cd agents/seo-optimizer && tsx agent.ts"

# Content tous les mercredis à 10h
caprover cron add --app dd-dashboard --schedule "0 10 * * WED" --command "cd agents/content-strategist && tsx agent.ts"
```

---

## 🎯 Tests avant mise en production

### Test manuel (local)

```bash
# 1. Vérifier que les dépendances sont installées
npm install

# 2. Lancer le Report Generator manuellement
npm run agent:report

# 3. Vérifier dans BigQuery
# → Table agent_runs doit avoir 1 nouvelle ligne
# → Table agent_insights doit avoir 1 nouveau rapport
```

### Test sur CapRover (staging)

```bash
# 1. SSH dans le container
caprover exec -a dd-dashboard

# 2. Lancer manuellement
npm run agent:report

# 3. Vérifier les logs
exit
caprover logs -a dd-dashboard --lines 50
```

---

## 📈 Monitoring

### Dashboard BigQuery (à créer)

```sql
-- Vue stats agents (derniers 30 jours)
SELECT * FROM `moverz-dashboard.analytics_core.v_agent_stats`
WHERE agent_name = 'report-generator'
```

### Alertes recommandées

**Créer une alerte si :**
- Le Report Generator échoue 2 lundis d'affilée
- La durée d'exécution > 60s
- Le score du rapport = 0.9+ (severity=critical)

---

## 💰 Coûts estimés

**Report Generator V1 (1 rapport global) :**
- Tokens/run : ~6-8K
- Coût/run : ~$0.15-0.20
- Fréquence : 4x/mois (hebdo)
- **Coût total : ~$0.60-0.80/mois**

**ROI :**
- Gain temps : ~2h/semaine (rapport manuel évité)
- Valeur : ~100€/semaine à 50€/h
- **ROI : x120** 🎯

---

**Dernière mise à jour :** 30 Octobre 2025  
**Mainteneur :** Guillaume Stehelin

