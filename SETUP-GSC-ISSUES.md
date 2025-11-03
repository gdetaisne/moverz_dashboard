# 🚀 Setup Rapide - Alertes GSC Issues

## Étape 1 : Configuration des variables d'environnement

**Dans le terminal, exporter les variables** (ou ajouter dans `.env` à la racine) :

```bash
export GCP_PROJECT_ID=moverz-dashboard
export BQ_DATASET=analytics_core
export SITES_LIST=devis-demenageur-marseille.fr
export TEST_MODE=true
export MAX_URLS_PER_SITE=5

# ⚠️ IMPORTANT : Remplacer avec ta vraie clé JSON (une seule ligne)
export GCP_SA_KEY_JSON='{"type":"service_account","project_id":"moverz-dashboard","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

**Ou créer/modifier `.env` à la racine du projet** :
```bash
cd /Users/guillaumestehelin/moverz_dashboard-2
cat > .env << 'EOF'
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
SITES_LIST=devis-demenageur-marseille.fr
TEST_MODE=true
MAX_URLS_PER_SITE=5
GCP_SA_KEY_JSON={"type":"service_account",...}  # Ton JSON complet ici
EOF
```

---

## Étape 2 : Appliquer la migration BigQuery

**Option A : Via BigQuery Console (recommandé si bq CLI pas installé)**

1. Aller sur [BigQuery Console](https://console.cloud.google.com/bigquery?project=moverz-dashboard)
2. Sélectionner le projet `moverz-dashboard`
3. Ouvrir le fichier `db/migrations/008_gsc_issues.sql`
4. Copier tout le contenu
5. Dans BigQuery Console → Query Editor
6. Coller le SQL
7. Cliquer "Run" (Exécuter)
8. ✅ Vérifier : la table `analytics_core.gsc_issues` doit apparaître

**Option B : Via bq CLI (si installé)**

```bash
cd /Users/guillaumestehelin/moverz_dashboard-2
bq query --use_legacy_sql=false < db/migrations/008_gsc_issues.sql
```

**Option C : Via script Node.js (alternatif)**

```bash
cd /Users/guillaumestehelin/moverz_dashboard-2
node -e "
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const bigquery = new BigQuery({ projectId: 'moverz-dashboard' });
const sql = fs.readFileSync('db/migrations/008_gsc_issues.sql', 'utf8');
bigquery.query(sql).then(([rows]) => console.log('✅ Migration appliquée')).catch(err => console.error('❌ Erreur:', err.message));
"
```

---

## Étape 3 : Vérifier que la table existe

**Via BigQuery Console** :
```sql
SELECT table_name 
FROM `moverz-dashboard.analytics_core.INFORMATION_SCHEMA.TABLES`
WHERE table_name = 'gsc_issues'
```

**Attendu** : 1 ligne retournée

---

## Étape 4 : Tester l'ETL

Une fois les variables configurées :

```bash
cd /Users/guillaumestehelin/moverz_dashboard-2
npm run etl:gsc-issues
```

**Ou avec le script de test** :
```bash
npm run test:gsc-issues
```

---

## Vérification finale

**1. Vérifier que des issues ont été insérés** :
```sql
SELECT COUNT(*) as total
FROM `moverz-dashboard.analytics_core.gsc_issues`
WHERE issue_date = CURRENT_DATE()
```

**2. Voir les issues détectés** :
```sql
SELECT 
  domain,
  issue_type,
  severity,
  title,
  affected_pages_count
FROM `moverz-dashboard.analytics_core.gsc_issues`
WHERE issue_date = CURRENT_DATE()
ORDER BY detected_at DESC
LIMIT 10
```

---

## 🐛 Troubleshooting

**Erreur "GCP_SA_KEY_JSON is required"**
→ Vérifier que la variable est bien exportée : `echo $GCP_SA_KEY_JSON`

**Erreur "Table not found: gsc_issues"**
→ Migration non appliquée → Refaire l'étape 2

**Erreur "Permission denied"**
→ Vérifier que le Service Account a les permissions BigQuery Data Editor + Job User

**Aucun issue détecté**
→ Normal si les pages sont bien indexées. Pour tester, utilise une page connue pour avoir un problème.

