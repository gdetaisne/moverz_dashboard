# 🚀 GUIDE DE DÉPLOIEMENT - MIGRATION BIGQUERY

**Objectif :** Appliquer les migrations et tester le dashboard en local puis en production.

---

## 📋 PRÉREQUIS

### 1. Credentials BigQuery

Tu dois avoir :
- Un projet GCP : `moverz-dashboard`
- Un service account avec permissions BigQuery
- Les credentials JSON

**Où les obtenir :**
```
https://console.cloud.google.com/iam-admin/serviceaccounts
→ Créer ou sélectionner un service account
→ Générer une clé JSON
```

### 2. Variables d'environnement

**Créer `dashboard/.env.local`** :
```bash
cd dashboard
cp .env.example .env.local
```

**Remplir avec tes credentials** :
```bash
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GCP_SA_KEY_JSON='{"type":"service_account",...}'  # Clé JSON complète
```

---

## 🔧 ÉTAPE 1 : Appliquer les migrations BigQuery

### Option A : Script Node.js (Recommandé)

```bash
cd dashboard
npx tsx ../scripts/apply-bigquery-migrations.ts
```

**Attendu :**
```
🚀 Application des migrations BigQuery
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 006_errors_404_urls.sql (53 lignes)
   Exécution...
   ✅ Succès

📄 007_broken_links.sql (31 lignes)
   Exécution...
   ✅ Succès

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Migrations appliquées avec succès!
```

### Option B : Interface Web BigQuery

1. Aller sur : https://console.cloud.google.com/bigquery
2. Sélectionner projet : `moverz-dashboard`
3. Cliquer "Compose new query" (SQL Editor)
4. Copier le contenu de `db/migrations/006_errors_404_urls.sql`
5. Cliquer "Run"
6. Répéter pour `007_broken_links.sql`

**Vérifier :**
```sql
-- Dans BigQuery SQL Editor
SELECT table_name 
FROM \`moverz-dashboard.analytics_core.INFORMATION_SCHEMA.TABLES\`
WHERE table_name LIKE '%404%' OR table_name LIKE '%broken%'
```

Tu devrais voir :
- `errors_404_history`
- `errors_404_urls`
- `broken_links`

---

## 🧪 ÉTAPE 2 : Tester en local

### 1. Lancer le serveur

```bash
cd dashboard
npm run dev
```

Ouvrir : http://localhost:3000

### 2. Lancer un crawl 404

1. Aller sur : http://localhost:3000/404
2. Cliquer "Analyser les 404"
3. Attendre la fin (30-60s)

**Vérifier les logs :**
```
💾 Enregistrement dans BigQuery...
✅ Historique BigQuery enregistré (ID: xxx-xxx)
✅ URLs 404/410 sauvegardées (xxx)
✅ Liens cassés visibles sauvegardés (xxx)
```

### 3. Vérifier dans BigQuery

**Query 1 : Historique**
```sql
SELECT 
  id,
  scan_date,
  total_sites,
  total_pages_checked,
  total_errors_404
FROM \`moverz-dashboard.analytics_core.errors_404_history\`
ORDER BY scan_date DESC
LIMIT 5
```

**Query 2 : URLs 404**
```sql
SELECT 
  scan_id,
  site,
  COUNT(*) as nb_urls
FROM \`moverz-dashboard.analytics_core.errors_404_urls\`
GROUP BY scan_id, site
ORDER BY scan_id DESC
LIMIT 20
```

**Query 3 : Liens cassés**
```sql
SELECT 
  scan_id,
  site,
  COUNT(*) as nb_links
FROM \`moverz-dashboard.analytics_core.broken_links\`
GROUP BY scan_id, site
ORDER BY scan_id DESC
LIMIT 20
```

### 4. Tester les APIs

**History :**
```bash
curl http://localhost:3000/api/404/history?days=30 | jq
```

**Last scan :**
```bash
curl http://localhost:3000/api/404/last | jq
```

**Delta :**
```bash
curl http://localhost:3000/api/404/delta | jq
```

### 5. Vérifier l'UI

Retourner sur http://localhost:3000/404 et vérifier :
- ✅ Résultats du crawl affichés
- ✅ Graphique historique fonctionne
- ✅ Bandeau delta apparaît (si 2+ scans)
- ✅ Export CSV liens cassés fonctionne

---

## 🌐 ÉTAPE 3 : Déployer en production

### Vérifications pré-déploiement

- [ ] Migrations BigQuery appliquées en prod
- [ ] Credentials BigQuery configurés en prod
- [ ] Tests locaux OK

### Déploiement CapRover

```bash
# Build et push
docker build -t moverz-dashboard .
docker tag moverz-dashboard registry.caprover.com/your-app:d4f4004
docker push registry.caprover.com/your-app:d4f4004

# OU via GitHub Actions (si configuré)
git push origin main  # Déclenche CI/CD
```

### Vérifier après déploiement

**1. Lancer un crawl de test :**
```bash
curl -X POST https://ton-domaine.fr/api/404/crawl
```

**2. Vérifier BigQuery :**
```sql
-- Vérifier que les données sont enregistrées
SELECT COUNT(*) as total_scans
FROM \`moverz-dashboard.analytics_core.errors_404_history\`
WHERE scan_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
```

**3. Monitoring :**
- Vérifier les logs CapRover
- Surveiller erreurs BigQuery
- Tester toutes les routes API

---

## 🐛 DÉPANNAGE

### Problème : "Table does not exist"

**Cause :** Migration non appliquée

**Solution :**
```bash
# Appliquer migration manuellement
bq query --use_legacy_sql=false < db/migrations/006_errors_404_urls.sql
```

### Problème : "Permission denied"

**Cause :** Service account n'a pas les bons rôles

**Solution :**
```
https://console.cloud.google.com/iam-admin/iam
→ Service account
→ Rôles : BigQuery Data Editor + BigQuery Job User
```

### Problème : "No module found: @google-cloud/bigquery"

**Cause :** Dépendances non installées

**Solution :**
```bash
cd dashboard
npm install
```

### Problème : "Credentials not found"

**Cause :** .env.local mal configuré

**Solution :**
```bash
# Vérifier le fichier existe
ls -la dashboard/.env.local

# Vérifier les variables
cat dashboard/.env.local | grep GCP_PROJECT_ID

# Vérifier le format de GCP_SA_KEY_JSON (JSON valide)
node -e "JSON.parse(process.env.GCP_SA_KEY_JSON)" <<< "test"
```

---

## ✅ CHECKLIST FINALE

### Local
- [ ] Migrations appliquées
- [ ] .env.local configuré
- [ ] Serveur démarre sans erreur
- [ ] Crawl 404 fonctionne
- [ ] Données dans BigQuery
- [ ] APIs retournent données
- [ ] UI affiche correctement

### Production
- [ ] Migrations appliquées en prod
- [ ] Credentials configurés
- [ ] Déploiement OK
- [ ] Crawl de test OK
- [ ] Monitoring activé
- [ ] Documentation à jour

---

## 📊 MÉTRIQUES DE SUCCÈS

**Avant :**
- Données JSON locales
- Pas de versioning
- Difficulté à scaler

**Après :**
- ✅ Données BigQuery cloud
- ✅ Queries ultra-rapides
- ✅ Scalabilité infinie
- ✅ Coût : < $1/mois

---

**Besoin d'aide ?** Consulter :
- `MIGRATION-COMPLETE.md` → Rapport détaillé
- `BIGQUERY-EXPLICATION-SIMPLE.md` → Tutoriel BigQuery
- Console BigQuery → https://console.cloud.google.com/bigquery

