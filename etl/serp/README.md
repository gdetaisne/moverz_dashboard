# 📸 ETL Snapshots Métadonnées SERP

Système de snapshot quotidien pour mesurer la performance des métadonnées SERP dans le temps.

## 🎯 Objectif

Capturer quotidiennement les métadonnées SERP (title, description, templates) et les associer aux performances GSC (impressions, clics, CTR) pour analyser l'impact des changements de métadonnées.

## 📋 Architecture

### Option 4 : Snapshot avec historique des métadonnées

- **Jour J** : Snapshot des métadonnées (temps réel) → Status `pending`
- **Jour J+2** : Complétion avec données GSC (disponibles j+2) → Status `complete`

### Flux

```
1. Snapshot quotidien (12:00)
   ↓
   Fetch métadonnées pour top 200 pages GSC
   ↓
   Détection type de page + template description
   ↓
   Insertion BigQuery (status: 'pending')

2. Complétion j+2 (13:00)
   ↓
   Récupération snapshots pending pour date-2
   ↓
   Récupération données GSC pour cette date
   ↓
   Mise à jour avec impressions/clics/ctr/position
   ↓
   Status: 'complete'

3. Health Check (14:00)
   ↓
   Vérification snapshot aujourd'hui
   ↓
   Vérification snapshot hier
   ↓
   Vérification snapshots pending > 3 jours
   ↓
   Alerte Slack si problème
```

## 📊 Table BigQuery

### `serp_metadata_snapshots`

**Colonnes principales :**
- `snapshot_date` : Date du snapshot (partition)
- `url` : URL de la page
- `metadata_date` : Date de capture des métadonnées (= snapshot_date)
- `gsc_date` : Date des données GSC (NULL si pending)
- `page_type` : Type de page (landing-ville, landing-services, etc.)
- `description_template_version` : Version du template (v1-landing-ville, custom, etc.)
- `status` : 'pending' | 'complete' | 'error'

**Métadonnées :**
- `title_text`, `description_text`
- `title_length`, `description_length`
- `intent`, `intent_source`, `intent_match_score`
- `rich_results_score`, `has_faq`, `has_rating`, etc.

**Performances GSC :**
- `impressions`, `clicks`, `ctr`, `position`

## 🚀 Scripts

### 1. `snapshot-metadata.ts`

Snapshot quotidien des métadonnées.

```bash
npx tsx etl/serp/snapshot-metadata.ts
```

**Fonctionnalités :**
- Récupère top 200 pages depuis GSC (30 derniers jours)
- Fetch métadonnées en parallèle (concurrency: 10)
- Détecte type de page et template de description
- Insère dans BigQuery avec status `pending`

**Variables d'environnement :**
- `GCP_SA_KEY_JSON` (requis)
- `GCP_PROJECT_ID` (requis)
- `BQ_DATASET` (requis)
- `SITES_LIST` (requis)
- `SERP_SNAPSHOT_LIMIT` (optionnel, défaut: 200)
- `BQ_LOCATION` (optionnel, défaut: europe-west1)

**Codes sortie :**
- `0` : Success
- `1` : Error
- `2` : Partial success

### 2. `complete-snapshots.ts`

Complète les snapshots pending avec données GSC j+2.

```bash
npx tsx etl/serp/complete-snapshots.ts
```

**Fonctionnalités :**
- Récupère snapshots pending pour date-2
- Récupère données GSC pour cette date
- Met à jour avec impressions/clics/ctr/position
- Change status de `pending` à `complete`

**Codes sortie :**
- `0` : Success
- `1` : Error

### 3. `check-snapshots-health.ts`

Health check quotidien avec alertes.

```bash
npx tsx etl/serp/check-snapshots-health.ts
```

**Vérifications :**
- Snapshot existe pour aujourd'hui
- Snapshot existe pour hier
- Pas de snapshots pending > 3 jours

**Alertes :**
- Slack (si `SLACK_WEBHOOK_URL` configuré)
- Exit code 1 si problème détecté

**Codes sortie :**
- `0` : OK
- `1` : Alert (problème détecté)

## ⏰ Scheduler Automatique

Les jobs sont automatiquement planifiés dans `etl/scheduler.ts` :

- **12:00** : Snapshot quotidien (`executeSerpSnapshotJob`)
- **13:00** : Complétion j+2 (`executeSerpCompleteJob`)
- **14:00** : Health check (`executeSerpHealthCheckJob`)

## 🔌 API Routes

### POST `/api/etl/serp-snapshot`

Lance le snapshot manuellement depuis le dashboard.

**Réponse :**
```json
{
  "success": true,
  "message": "Snapshot terminé avec succès (150 pages)",
  "data": {
    "success": 150,
    "failed": 0
  }
}
```

### POST `/api/etl/serp-complete`

Lance la complétion j+2 manuellement.

**Réponse :**
```json
{
  "success": true,
  "message": "Complétion terminée (150 snapshots complétés)",
  "data": {
    "completed": 150
  }
}
```

## 📈 Détection Type de Page

Types détectés :
- `landing-ville` : `/strasbourg`, `/rennes`, etc.
- `landing-services` : `/services/...`
- `landing-contact` : `/contact`
- `landing-partenaires` : `/partenaires`
- `landing-faq` : `/faq`
- `landing-comment-ca-marche` : `/comment-ca-marche`
- `landing-ville-vers-paris` : `/rennes-vers-paris`
- `landing-ville-vers-ville` : `/montpellier-vers-marseille`
- `landing-quartier` : `/bordeaux/merignac`
- `landing-home` : Homepage
- `blog` : Pages blog
- `other` : Autres

## 🎨 Détection Template Description

Templates détectés :
- `v1-landing-ville` : "Déménagez à {ville} dès 280€..."
- `v1-services` : "Découvrez nos formules..."
- `v1-contact` : "Contactez nos experts..."
- `v1-ville-vers-paris` : "Cahier des charges précis..."
- `v1-ville-vers-ville` : "Déménagement de {ville1} vers {ville2}..."
- `v1-blog` : "Guides complets et conseils..."
- `v1-partenaires` : "Découvrez nos partenaires..."
- `v1-faq` : "Questions clés déménagement..."
- `custom` : Ne correspond à aucun template
- `missing` : Description absente

## 🔍 Vues BigQuery

### `serp_metadata_snapshots_complete`

Snapshots avec performances complètes (status = 'complete').

### `serp_metadata_templates_evolution`

Évolution par template et type de page.

### `serp_metadata_snapshots_pending`

Snapshots en attente de complétion.

## 🚨 Alertes

Le health check vérifie :
1. ✅ Snapshot existe pour aujourd'hui
2. ✅ Snapshot existe pour hier
3. ✅ Pas de snapshots pending > 3 jours

Si problème détecté → Alerte Slack (si configuré).

## 📝 Migration

La migration `009_serp_metadata_snapshots.sql` crée :
- Table `serp_metadata_snapshots`
- 3 vues pour l'analyse

**Appliquer la migration :**
```bash
# Via script de migration ou directement dans BigQuery
bq query --use_legacy_sql=false < db/migrations/009_serp_metadata_snapshots.sql
```

## 🧪 Tests

### Test manuel snapshot

```bash
cd /path/to/project
npx tsx etl/serp/snapshot-metadata.ts
```

### Test manuel complétion

```bash
npx tsx etl/serp/complete-snapshots.ts
```

### Test health check

```bash
npx tsx etl/serp/check-snapshots-health.ts
```

## 📊 Utilisation Dashboard

Les données seront utilisées dans `/serp/analyse` pour :
- Comparer performance des templates
- Analyser évolution CTR par type de page
- Détecter changements de métadonnées
- Recommander optimisations

