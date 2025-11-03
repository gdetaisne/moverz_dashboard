# 🧪 Guide de Test - Alertes GSC Issues

## Prérequis

1. **Migration BigQuery appliquée**
   ```bash
   bq query --use_legacy_sql=false < db/migrations/008_gsc_issues.sql
   ```

2. **Variables d'environnement configurées**
   ```bash
   export GCP_PROJECT_ID=moverz-dashboard
   export BQ_DATASET=analytics_core
   export GCP_SA_KEY_JSON='{"type":"service_account",...}'
   export SITES_LIST=devis-demenageur-marseille.fr
   export TEST_MODE=true  # Limite à 1 site et 5 pages
   export MAX_URLS_PER_SITE=5
   ```

## Test 1 : ETL en mode test

```bash
# Mode test (1 site, 5 pages max)
TEST_MODE=true MAX_URLS_PER_SITE=5 npm run etl:gsc-issues

# Ou via le script de test
npm run test:gsc-issues
```

**Attendu** :
- Inspection de 1 seul site
- Maximum 5 pages inspectées
- Logs détaillés du processus
- Issues détectés insérés dans BigQuery

## Test 2 : Vérifier les données BigQuery

```sql
-- Issues détectées
SELECT 
  domain,
  issue_type,
  severity,
  status,
  title,
  affected_pages_count,
  detected_at
FROM `moverz-dashboard.analytics_core.gsc_issues`
WHERE issue_date = CURRENT_DATE()
ORDER BY detected_at DESC
LIMIT 10;

-- Stats
SELECT * FROM `moverz-dashboard.analytics_core.v_gsc_issues_stats`;
```

## Test 3 : Dashboard local

```bash
# Terminal 1 : Lancer le dashboard
cd dashboard
npm run dev

# Terminal 2 : Vérifier que ça fonctionne
curl http://localhost:3000/dashboard-api/gsc/issues?days=30
```

**Accéder à** : http://localhost:3000/gsc-issues

## Test 4 : API route directement

```bash
# Tester l'endpoint API
curl "http://localhost:3000/dashboard-api/gsc/issues?domain=all&severity=all&status=open&days=30" | jq
```

**Réponse attendue** :
```json
{
  "success": true,
  "issues": [...],
  "stats": {
    "total": 5,
    "by_severity": {
      "error": 2,
      "warning": 3,
      "info": 0
    },
    "by_status": {
      "open": 5,
      "resolved": 0,
      "fixed": 0
    }
  }
}
```

## Dépannage

### Erreur "GCP_SA_KEY_JSON is required"
→ Vérifier que la variable est exportée ou dans `.env`

### Erreur "Table not found: gsc_issues"
→ Appliquer la migration : `bq query --use_legacy_sql=false < db/migrations/008_gsc_issues.sql`

### Erreur "Rate limited"
→ Réduire `MAX_URLS_PER_SITE` ou augmenter les pauses entre batches

### Pas d'issues détectées
→ Normal si les pages sont bien indexées. Vérifier avec une page connue pour avoir un problème.

