# 🔧 Troubleshooting : Historique 404 Vide

## ❓ Pourquoi la section "Évolution des Erreurs 404" est vide ?

La section affiche "Aucune donnée historique disponible" car :

### 1️⃣ **Table BigQuery n'existe pas** (Cause la plus probable)

La migration n'a pas été appliquée, donc la table `errors_404_history` n'existe pas.

**Solution** :
```bash
# Appliquer la migration BigQuery
bq query --use_legacy_sql=false < db/migrations/004_errors_404_history.sql

# Vérifier que la table existe
bq ls moverz-dashboard:analytics_core
# Vous devriez voir : errors_404_history
```

### 2️⃣ **Variables d'environnement manquantes**

Les credentials BigQuery ne sont pas configurés.

**Solution** : Créer `.env.local` dans `dashboard/` :
```bash
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GCP_SA_KEY_JSON={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

### 3️⃣ **Aucun scan n'a été enregistré**

Même si la table existe, si aucun scan n'a été fait ou enregistré avec succès, l'historique sera vide.

**Solution** :
1. Lancer un nouveau scan : cliquer sur "Analyser les 404"
2. Attendre la fin du crawl (~30-60s)
3. Vérifier les logs de la console pour voir si l'enregistrement a réussi

---

## 🐛 Comment diagnostiquer ?

### Étape 1 : Vérifier les logs de l'API

Ouvrir la console du navigateur (F12) et regarder les requêtes :

**GET /api/404/history**
- **Si erreur 500** : BigQuery non configuré ou table manquante
- **Si succès avec `evolution: []`** : Table existe mais aucune donnée

### Étape 2 : Vérifier les logs du serveur

Lors d'un scan, regarder les logs dans la console :

**Enregistrement réussi** :
```
✅ Historique enregistré dans BigQuery (ID: xxx-xxx-xxx)
```

**Enregistrement échoué** :
```
⚠️ Erreur lors de l'enregistrement BigQuery: ...
⚠️ Détails: { code: ..., message: ... }
```

### Étape 3 : Vérifier BigQuery directement

```bash
# Se connecter à BigQuery
bq query --use_legacy_sql=false "
  SELECT 
    COUNT(*) as total_scans,
    MAX(scan_date) as dernier_scan
  FROM \`moverz-dashboard.analytics_core.errors_404_history\`
"
```

**Si erreur "Table not found"** → Migration non appliquée  
**Si 0 rows** → Aucun scan enregistré  
**Si rows > 0** → Données présentes, problème d'affichage

---

## ✅ Check-list de résolution

- [ ] Migration BigQuery appliquée
- [ ] Variables d'environnement configurées
- [ ] Credentials BigQuery valides
- [ ] Au moins un scan effectué et enregistré avec succès
- [ ] API `/api/404/history` retourne `success: true`
- [ ] Données présentes dans BigQuery

---

## 🚀 Mode de fonctionnement "sans BigQuery"

Si vous voulez tester l'interface **sans** configurer BigQuery, le système continuera à fonctionner :

- ✅ Le crawl fonctionne normalement
- ✅ Les résultats s'affichent dans la table
- ✅ La ligne TOTAL est calculée
- ❌ L'historique reste vide (comportement attendu)

**C'est normal** : l'historique nécessite BigQuery pour stocker les données entre les scans.

---

## 📊 Flux technique complet

```
1. Utilisateur lance un scan → POST /api/404/crawl
2. Crawl des 11 sites (parallèle)
3. Calcul des totaux (total_errors_404 = 369)
4. Tentative d'enregistrement BigQuery :
   ├─ SUCCÈS → Données sauvegardées
   └─ ÉCHEC → Log d'erreur, crawl continue quand même
5. Affichage des résultats dans la table
6. UI charge historique → GET /api/404/history
   ├─ Table existe + données → Graphique s'affiche
   └─ Table absente OU vide → Message "Aucune donnée"
```

---

## 🎯 Pour avoir un historique fonctionnel

**Minimum requis** :
1. Table BigQuery créée (migration appliquée)
2. Credentials configurés (variables d'environnement)
3. Au moins 2 scans effectués (pour avoir une évolution)

**Recommandé** :
1. Configurer les variables dans `.env.local`
2. Appliquer la migration en production
3. Lancer un scan quotidien (via cron si nécessaire)
4. Vérifier régulièrement que les données s'enregistrent

---

**📌 Note** : Le message "Aucune donnée historique disponible" est **normal** si BigQuery n'est pas configuré. Le crawl fonctionne quand même, seule la visualisation de l'historique nécessite BigQuery.

