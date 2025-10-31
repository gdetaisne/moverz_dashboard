# 🔍 AUDIT COMPLET : Historique des Erreurs 404

**Date :** 2025-01-XX  
**Objectif :** Diagnostiquer pourquoi l'historique ne s'affiche pas malgré les données dans BigQuery

---

## 📋 CHECKLIST DE VÉRIFICATION

### 1. ✅ Structure de la Table BigQuery

**Migration :** `db/migrations/004_errors_404_history.sql`
- Table : `moverz-dashboard.analytics_core.errors_404_history`
- Partition : `DATE(scan_date)`
- Clustering : `scan_date` (défini dans la migration mais pas dans CREATE TABLE)
- Colonnes :
  - `id STRING NOT NULL`
  - `scan_date TIMESTAMP NOT NULL` ⚠️
  - `total_sites INT64 NOT NULL`
  - `total_pages_checked INT64 NOT NULL`
  - `total_errors_404 INT64 NOT NULL`
  - `sites_results JSON NOT NULL`
  - `crawl_duration_seconds INT64 NOT NULL`
  - `created_at TIMESTAMP` (nullable, DEFAULT CURRENT_TIMESTAMP)

**⚠️ PROBLÈME POTENTIEL :** Le clustering n'est pas défini dans le CREATE TABLE initial. Il faudrait un ALTER TABLE.

---

### 2. ✅ Flux d'Insertion des Données

**Code :** `dashboard/app/api/404/crawl/route.ts:371-384`

```typescript
const scanId = randomUUID()
const now = new Date().toISOString()  // ⚠️ Format ISO string: "2025-01-15T14:30:00.000Z"

await insertError404History({
  id: scanId,
  scan_date: now,  // ⚠️ STRING au lieu de TIMESTAMP
  total_sites: results.length,
  total_pages_checked: totalPages,
  total_errors_404: totalErrors,
  sites_results: results.map(...),
  crawl_duration_seconds: totalDuration,
})
```

**⚠️ PROBLÈME IDENTIFIÉ :**
- `scan_date` est une **STRING ISO** (`"2025-01-15T14:30:00.000Z"`)
- La table attend un **TIMESTAMP**
- BigQuery devrait convertir automatiquement, mais peut échouer silencieusement

**Code d'insertion :** `dashboard/lib/bigquery.ts:214-240`
```typescript
params: {
  scan_date: entry.scan_date,  // STRING passée directement
}
```

**✅ SOLUTION :** Convertir explicitement en TIMESTAMP dans la requête SQL

---

### 3. ✅ Flux de Récupération des Données

**API Route :** `dashboard/app/api/404/history/route.ts`
- Mode par défaut : `mode='last'` → `getLastScansAsEvolution(20)`
- Mode alternatif : `mode='evolution'` → `getError404Evolution(30)`

**Requête `getError404Evolution` :**
```sql
SELECT 
  FORMAT_TIMESTAMP('%Y-%m-%dT00:00:00', TIMESTAMP(DATE(scan_date))) as date,
  COUNT(*) as nb_scans,
  ...
FROM `moverz-dashboard.analytics_core.errors_404_history`
WHERE scan_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY DATE(scan_date)
ORDER BY date DESC
```

**⚠️ PROBLÈMES POTENTIELS :**
1. Si `scan_date` est stocké comme STRING au lieu de TIMESTAMP, la requête peut échouer
2. Le `WHERE` filtre avec `TIMESTAMP_SUB` qui nécessite un TIMESTAMP
3. Si aucune donnée n'est dans les 30 derniers jours, retourne vide

**Requête `getLastScansAsEvolution` :**
```sql
SELECT 
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S', scan_date) as date,
  ...
FROM `moverz-dashboard.analytics_core.errors_404_history`
ORDER BY scan_date DESC
LIMIT 20
```

---

### 4. ✅ Gestion des Erreurs

**Insertion :** `dashboard/app/api/404/crawl/route.ts:419-422`
```typescript
} catch (error: any) {
  console.error('⚠️ Erreur lors de l\'enregistrement BigQuery:', error.message)
  // Ne pas faire échouer le crawl si l'écriture BigQuery échoue
}
```

**⚠️ PROBLÈME :** Les erreurs sont silencieusement ignorées ! Si l'insertion échoue, on ne le sait pas.

**Récupération :** `dashboard/app/api/404/history/route.ts:39-57`
```typescript
} catch (error: any) {
  // Retourne succès avec données vides
  return NextResponse.json({
    success: true,
    data: { evolution: [], lastScan: null },
    error: error.message,
  })
}
```

**⚠️ PROBLÈME :** Les erreurs sont masquées, l'UI affiche "Aucune donnée" même si c'est une erreur.

---

## 🔧 CORRECTIONS NÉCESSAIRES

### 1. Convertir scan_date en TIMESTAMP lors de l'insertion

```typescript
// dashboard/lib/bigquery.ts
export async function insertError404History(entry: ...) {
  const query = `
    INSERT INTO \`${projectId}.${dataset}.errors_404_history\` (
      id, scan_date, total_sites, total_pages_checked, total_errors_404,
      sites_results, crawl_duration_seconds
    )
    VALUES (
      @id, TIMESTAMP(@scan_date), @total_sites, @total_pages_checked, @total_errors_404,
      @sites_results, @crawl_duration_seconds
    )
  `
}
```

### 2. Améliorer le logging des erreurs

```typescript
// dashboard/app/api/404/crawl/route.ts
} catch (error: any) {
  console.error('⚠️ Erreur lors de l\'enregistrement BigQuery:', error)
  console.error('Stack:', error.stack)
  console.error('Details:', JSON.stringify(error, null, 2))
  // Ne pas faire échouer le crawl si l'écriture BigQuery échoue
}
```

### 3. Exposer les erreurs dans l'API history

```typescript
// dashboard/app/api/404/history/route.ts
} catch (error: any) {
  console.error('API /404/history error:', error)
  console.error('Stack:', error.stack)
  
  return NextResponse.json({
    success: false,  // ⚠️ Changer à false
    data: { evolution: [], lastScan: null },
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  }, { status: 500 })
}
```

### 4. Ajouter un endpoint de diagnostic

Créer `/api/404/debug` pour :
- Vérifier si la table existe
- Compter les enregistrements
- Tester une requête simple
- Vérifier le format des données

---

## 🧪 TESTS DE DIAGNOSTIC À EFFECTUER

### Test 1 : Vérifier l'existence de la table
```sql
SELECT COUNT(*) as total
FROM `moverz-dashboard.analytics_core.errors_404_history`
```

### Test 2 : Vérifier les données récentes
```sql
SELECT 
  id,
  scan_date,
  total_sites,
  total_errors_404,
  TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), scan_date, DAY) as days_ago
FROM `moverz-dashboard.analytics_core.errors_404_history`
ORDER BY scan_date DESC
LIMIT 10
```

### Test 3 : Vérifier le format de scan_date
```sql
SELECT 
  scan_date,
  TYPEOF(scan_date) as scan_date_type,
  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S', scan_date) as formatted
FROM `moverz-dashboard.analytics_core.errors_404_history`
LIMIT 1
```

### Test 4 : Vérifier la requête d'évolution
```sql
SELECT 
  FORMAT_TIMESTAMP('%Y-%m-%dT00:00:00', TIMESTAMP(DATE(scan_date))) as date,
  COUNT(*) as nb_scans,
  CAST(AVG(total_errors_404) AS INT64) as avg_errors_404
FROM `moverz-dashboard.analytics_core.errors_404_history`
WHERE scan_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY DATE(scan_date)
ORDER BY date DESC
```

---

## 🎯 ACTIONS IMMÉDIATES

1. **Créer un endpoint de diagnostic** pour tester en production
2. **Corriger la conversion TIMESTAMP** dans insertError404History
3. **Améliorer le logging** pour voir les vraies erreurs
4. **Tester avec une requête BigQuery directe** pour vérifier les données

