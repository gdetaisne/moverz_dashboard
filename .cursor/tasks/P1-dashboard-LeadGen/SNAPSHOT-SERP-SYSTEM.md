# 📸 Système de Snapshot SERP - Documentation

**Date de création:** 2025-01-XX  
**Statut:** ✅ Opérationnel  
**Dernière mise à jour:** 2025-01-XX

---

## 🎯 Objectif

Système automatisé de snapshot quotidien des métadonnées SERP pour mesurer la performance des métadonnées (title, description) dans le temps.

**Problématique résolue :**
- Les métadonnées SERP sont en temps réel
- Les données GSC (impressions, clics) sont disponibles avec un délai de j+2
- Besoin de corréler les changements de métadonnées avec les performances

---

## 🏗️ Architecture

### 1. Table BigQuery : `serp_metadata_snapshots`

**Structure :**
- Partitionnée par `snapshot_date` (requiert un filtre)
- Clustered par `url`, `page_type`, `status`
- Rétention : 730 jours (2 ans)

**Champs principaux :**
- `snapshot_date` : Date du snapshot (DATE)
- `url` : URL de la page (STRING)
- `metadata_date` : Date de récupération des métadonnées (DATE)
- `page_type` : Type de page (landing-ville, landing-home, blog, etc.)
- `description_template_version` : Version du template (v1-landing-ville, custom, missing)
- `title_text`, `description_text` : Métadonnées récupérées
- `title_length`, `description_length` : Longueurs
- `gsc_date` : Date des données GSC (j+2)
- `impressions`, `clicks`, `ctr`, `position` : Métriques GSC
- `status` : `pending` (métadonnées seulement) ou `complete` (avec GSC)

### 2. Scripts ETL

#### `etl/serp/snapshot-metadata.ts`
**Fonction :** Snapshot quotidien des métadonnées  
**Exécution :** Tous les jours à 12:00  
**Actions :**
1. Récupère les top pages depuis GSC (30 derniers jours)
2. Fetch les métadonnées de chaque page (title, description, rich results)
3. Détecte le type de page et la version du template
4. Insère dans BigQuery avec `status='pending'`

#### `etl/serp/complete-snapshots.ts`
**Fonction :** Complétion des snapshots avec données GSC j+2  
**Exécution :** Tous les jours à 13:00  
**Actions :**
1. Récupère les snapshots `pending` pour la date j-2
2. Récupère les données GSC pour cette date
3. Met à jour les snapshots avec `impressions`, `clicks`, `ctr`, `position`
4. Change le `status` à `complete`

#### `etl/serp/check-snapshots-health.ts`
**Fonction :** Vérification de santé du système  
**Exécution :** Tous les jours à 14:00  
**Actions :**
1. Vérifie les snapshots manquants
2. Vérifie les snapshots `pending` en retard (> 3 jours)
3. Envoie des alertes si problèmes détectés

### 3. API Routes

#### `GET /api/serp/export-csv`
**Fonction :** Export CSV de toutes les données  
**Filtre :** 365 derniers jours (requis par partition BigQuery)  
**Format :** CSV avec en-têtes, dates au format ISO

---

## ⏰ Planning d'Exécution

### Snapshot quotidien automatique
- **Heure :** 12:00 (Europe/Paris)
- **Fréquence :** Tous les jours
- **Job :** `executeSerpSnapshotJob`

### Complétion j+2
- **Heure :** 13:00 (Europe/Paris)
- **Fréquence :** Tous les jours
- **Job :** `executeSerpCompleteJob`

### Health Check
- **Heure :** 14:00 (Europe/Paris)
- **Fréquence :** Tous les jours
- **Job :** `executeSerpHealthCheckJob`

### Test initial
- **Date :** 2025-01-XX (premier jour)
- **Heure :** 12:15 (test dans 15 minutes après démarrage)
- **Objectif :** Vérifier le fonctionnement du système

---

## ✅ Vérification du Système

### 1. Vérifier que le scheduler tourne

```bash
# Vérifier les logs du scheduler
# Les logs doivent montrer :
# - "⏰ SERP Metadata Snapshot scheduled: daily at 12:00"
# - "⏰ SERP Snapshots Completion scheduled: daily at 13:00"
# - "⏰ SERP Health Check scheduled: daily at 14:00"
```

### 2. Vérifier le premier snapshot (12:00)

**Le lendemain à 12:00, vérifier :**

```sql
-- Dans BigQuery
SELECT 
  snapshot_date,
  COUNT(*) as total_snapshots,
  COUNTIF(status = 'pending') as pending,
  COUNTIF(status = 'complete') as complete
FROM `moverz-dashboard.analytics_core.serp_metadata_snapshots`
WHERE snapshot_date = CURRENT_DATE()
GROUP BY snapshot_date
```

**Résultat attendu :**
- `total_snapshots` > 0
- `pending` > 0 (les données GSC ne sont pas encore disponibles)
- `complete` = 0 (les données GSC seront complétées j+2)

### 3. Vérifier la complétion j+2 (13:00)

**Le jour j+2 à 13:00, vérifier :**

```sql
-- Vérifier les snapshots complétés pour j-2
SELECT 
  snapshot_date,
  COUNT(*) as total,
  COUNTIF(status = 'complete') as complete,
  COUNTIF(impressions IS NOT NULL) as with_impressions
FROM `moverz-dashboard.analytics_core.serp_metadata_snapshots`
WHERE snapshot_date = DATE_SUB(CURRENT_DATE(), INTERVAL 2 DAY)
GROUP BY snapshot_date
```

**Résultat attendu :**
- `complete` > 0
- `with_impressions` > 0

### 4. Vérifier l'export CSV

**Depuis l'interface :**
1. Aller sur `/serp/analyse`
2. Cliquer sur "Télécharger CSV"
3. Vérifier que le CSV contient :
   - Les en-têtes corrects
   - Les dates au format ISO (pas `[object Object]`)
   - Des données pour les snapshots créés

### 5. Vérifier le health check (14:00)

**Vérifier les logs :**
- Pas d'erreurs dans les logs
- Si problèmes détectés, le health check doit logger des alertes

---

## 🔍 Données Disponibles

### Métadonnées (temps réel)
- `title_text` : Titre de la page
- `description_text` : Description meta
- `title_length`, `description_length` : Longueurs
- `page_type` : Type de page détecté
- `description_template_version` : Version du template

### Métriques GSC (j+2)
- `impressions` : Nombre d'impressions
- `clicks` : Nombre de clics
- `ctr` : Taux de clic
- `position` : Position moyenne

### Rich Results
- `has_faq`, `has_rating`, `has_breadcrumb`, etc.
- `rich_results_score` : Score calculé

### Intent & Qualité
- `intent` : Intention détectée (transactional, informational)
- `intent_source` : Source (jsonld, inferred)
- `intent_match_score` : Score de correspondance
- `length_score` : Score de longueur

---

## 🚨 Alertes & Monitoring

### Health Check détecte :
1. **Snapshots manquants** : Pas de snapshot pour une date attendue
2. **Snapshots pending en retard** : Snapshots `pending` > 3 jours sans complétion
3. **Erreurs de fetch** : Pages non accessibles (404, timeout)

### Actions en cas d'alerte :
1. Vérifier les logs du scheduler
2. Vérifier la connectivité BigQuery
3. Vérifier l'accès aux sites (fetch des métadonnées)
4. Relancer manuellement si nécessaire

---

## 🛠️ Commandes Utiles

### Lancer un snapshot manuel

```bash
# Via l'API
curl -X POST http://localhost:3000/api/etl/serp-snapshot

# Via le script directement
cd /Users/guillaumestehelin/moverz_dashboard-2
npx tsx etl/serp/snapshot-metadata.ts
```

### Compléter manuellement les snapshots

```bash
# Via l'API
curl -X POST http://localhost:3000/api/etl/serp-complete

# Via le script directement
npx tsx etl/serp/complete-snapshots.ts
```

### Vérifier la santé

```bash
npx tsx etl/serp/check-snapshots-health.ts
```

### Requête BigQuery pour voir les données

```sql
-- Tous les snapshots récents
SELECT *
FROM `moverz-dashboard.analytics_core.serp_metadata_snapshots`
WHERE snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
ORDER BY snapshot_date DESC, impressions DESC NULLS LAST
LIMIT 100
```

---

## 📊 Prochaines Étapes

### Améliorations possibles
1. **Données supplémentaires à extraire :**
   - H1 de la page
   - Structured Data (JSON-LD)
   - Open Graph / Twitter Cards
   - Métriques de contenu (word count, liens)

2. **Analyses à développer :**
   - Comparaison avant/après changement de template
   - Performance par type de page
   - Performance par version de template
   - Corrélation métadonnées / performances GSC

3. **Visualisations :**
   - Graphiques d'évolution des métadonnées
   - Comparaison des templates
   - Impact des changements sur les performances

---

## 📝 Notes Techniques

### Contraintes BigQuery
- La table est partitionnée avec `require_partition_filter=TRUE`
- Toutes les requêtes doivent filtrer sur `snapshot_date`
- Export CSV filtre sur 365 derniers jours

### Gestion des erreurs
- Les pages non accessibles (404, timeout) sont enregistrées avec `fetch_success=false`
- Les snapshots avec erreurs gardent `status='pending'` jusqu'à résolution
- Le health check détecte les problèmes

### Performance
- Snapshot quotidien : ~5 minutes pour ~100-200 pages
- Complétion j+2 : ~2-3 minutes
- Health check : < 1 minute

---

## 🔗 Références

- **Scripts ETL :** `etl/serp/`
- **Scheduler :** `etl/scheduler.ts`
- **API Routes :** `dashboard/app/api/serp/`
- **Page Analyse :** `dashboard/app/serp/analyse/page.tsx`
- **Migration BigQuery :** `db/migrations/009_serp_metadata_snapshots.sql`

---

**Documentation créée le 2025-01-XX pour vérification le lendemain.**

