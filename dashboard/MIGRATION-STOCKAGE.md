# 🔄 PLAN DE MIGRATION : RÉSOLUTION DU DOUBLE STOCKAGE

**Problème :** Historique 404 stocké dans 2 systèmes (JSON + BigQuery)  
**Objectif :** Utiliser BigQuery comme source unique  
**Durée estimée :** 3 jours

---

## 📊 ÉTAT ACTUEL

### Systèmes en place

#### 1. JSON (Actif, utilisé)
```
dashboard/data/
├── errors-404-history.json       # Historique scans
├── errors-404-urls.json           # URLs 404/410 par scan
├── broken-links.json              # Liens cassés persistants
└── broken-links-scans.json        # Liens cassés par scan
```

**Utilisé par :**
- ✅ `/api/404/history` → lit JSON
- ✅ `/api/404/last` → lit JSON
- ✅ `/api/404/delta` → lit JSON
- ✅ `/api/404/crawl` → écrit JSON

#### 2. BigQuery (Partiel, NON utilisé)
```sql
-- Table existe (migration 004 appliquée)
errors_404_history (
  id, scan_date, total_sites, total_pages_checked,
  total_errors_404, sites_results, crawl_duration_seconds
)
```

**Code existant mais non utilisé :**
- `lib/bigquery.ts:214` → `insertError404History()`
- `lib/bigquery.ts:242` → `getError404Evolution()`
- `lib/bigquery.ts:262` → `getLastError404Scan()`

---

## 🎯 STRATÉGIE DE MIGRATION

### Phase 1 : Préparation BigQuery (Jour 1)

#### 1.1 Créer tables manquantes

**Table `errors_404_urls` (URLs 404/410 détaillées) :**
```sql
CREATE TABLE IF NOT EXISTS `moverz.errors_404_urls` (
  scan_id STRING NOT NULL,
  scan_date TIMESTAMP NOT NULL,
  site STRING NOT NULL,
  path STRING NOT NULL,
  status STRING NOT NULL, -- '404' or '410'
  commit_sha STRING,
  branch STRING,
  actor STRING,
  repo STRING,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) PARTITION BY DATE(scan_date)
OPTIONS(
  description="URLs 404/410 détaillées par scan",
  partition_expiration_days=730
);

-- Clustering
ALTER TABLE `moverz.errors_404_urls`
SET OPTIONS (clustering_fields = "site,scan_date");
```

**Table `broken_links` (Liens cassés visibles) :**
```sql
CREATE TABLE IF NOT EXISTS `moverz.broken_links` (
  scan_id STRING NOT NULL,
  scan_date TIMESTAMP NOT NULL,
  site STRING NOT NULL,
  source_url STRING NOT NULL, -- Page contenant le lien
  target_url STRING NOT NULL, -- URL cassée
  commit_sha STRING,
  branch STRING,
  actor STRING,
  repo STRING,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) PARTITION BY DATE(scan_date)
OPTIONS(
  description="Liens cassés visibles par scan",
  partition_expiration_days=730
);

-- Clustering
ALTER TABLE `moverz.broken_links`
SET OPTIONS (clustering_fields = "site,scan_date");

-- Index composite pour queries rapides
CREATE INDEX IF NOT EXISTS idx_broken_links_site_date
ON `moverz.broken_links`(site, scan_date);
```

#### 1.2 Compléter `lib/bigquery.ts`

Ajouter fonctions manquantes :
```typescript
// lib/bigquery.ts

export interface Error404UrlEntry {
  site: string
  path: string
  status: '404' | '410'
}

export interface Error404UrlScan {
  scan_id: string
  scan_date: string
  commit_sha?: string
  branch?: string
  actor?: string
  repo?: string
  entries: Error404UrlEntry[]
}

export interface BrokenLinksScan {
  scan_id: string
  scan_date: string
  commit_sha?: string
  branch?: string
  actor?: string
  repo?: string
  links: Array<{
    site: string
    source: string
    target: string
  }>
}

// Insert URLs 404/410
export async function insertError404UrlsScan(scan: Error404UrlScan) {
  // Requête d'insertion avec UNNEST
  const query = `
    INSERT INTO \`${projectId}.${dataset}.errors_404_urls\`
    (scan_id, scan_date, site, path, status, commit_sha, branch, actor, repo)
    SELECT 
      @scan_id,
      @scan_date,
      entry.site,
      entry.path,
      entry.status,
      @commit_sha,
      @branch,
      @actor,
      @repo
    FROM UNNEST(@entries) as entry
  `
  
  await bigquery.query({
    query,
    params: {
      scan_id: scan.scan_id,
      scan_date: scan.scan_date,
      entries: scan.entries,
      commit_sha: scan.commit_sha || null,
      branch: scan.branch || null,
      actor: scan.actor || null,
      repo: scan.repo || null,
    },
  })
}

// Insert liens cassés
export async function insertBrokenLinksScan(scan: BrokenLinksScan) {
  const query = `
    INSERT INTO \`${projectId}.${dataset}.broken_links\`
    (scan_id, scan_date, site, source_url, target_url, commit_sha, branch, actor, repo)
    SELECT 
      @scan_id,
      @scan_date,
      link.site,
      link.source,
      link.target,
      @commit_sha,
      @branch,
      @actor,
      @repo
    FROM UNNEST(@links) as link
  `
  
  await bigquery.query({
    query,
    params: {
      scan_id: scan.scan_id,
      scan_date: scan.scan_date,
      links: scan.links,
      commit_sha: scan.commit_sha || null,
      branch: scan.branch || null,
      actor: scan.actor || null,
      repo: scan.repo || null,
    },
  })
}

// Delta URLs 404
export async function getError404Delta(params: { from?: string; to?: string }): Promise<Error404DeltaResult | null> {
  // Requête avec window functions pour comparer 2 scans
  const query = `
    WITH scan_ids AS (
      SELECT DISTINCT scan_id, scan_date
      FROM \`${projectId}.${dataset}.errors_404_urls\`
      ORDER BY scan_date DESC
      LIMIT 2
    ),
    from_scan AS (
      SELECT scan_id FROM scan_ids ORDER BY scan_date ASC LIMIT 1
    ),
    to_scan AS (
      SELECT scan_id FROM scan_ids ORDER BY scan_date DESC LIMIT 1
    ),
    from_urls AS (
      SELECT CONCAT(site, '|', path) as key
      FROM \`${projectId}.${dataset}.errors_404_urls\`
      WHERE scan_id = (SELECT scan_id FROM from_scan)
    ),
    to_urls AS (
      SELECT 
        CONCAT(site, '|', path) as key,
        site,
        path
      FROM \`${projectId}.${dataset}.errors_404_urls\`
      WHERE scan_id = (SELECT scan_id FROM to_scan)
    )
    SELECT 
      (SELECT scan_id FROM from_scan) as from_scan_id,
      (SELECT scan_id FROM to_scan) as to_scan_id,
      ARRAY_AGG(STRUCT(site, path) ORDER BY site, path) as gained,
      (SELECT COUNT(*) FROM from_urls f WHERE f.key IN (SELECT key FROM to_urls)) as persisting
    FROM to_urls t
    WHERE t.key NOT IN (SELECT key FROM from_urls)
  `
  
  const [rows] = await bigquery.query({ query })
  return rows[0] as Error404DeltaResult | null
}

// Delta liens cassés
export async function getBrokenLinksDelta(params: { from?: string; to?: string }): Promise<BrokenLinksDeltaResult | null> {
  // Similaire à getError404Delta mais sur table broken_links
  // ...
}

// Récupérer dernier scan reconstruit (avec URLs + liens)
export async function getLastReconstructedScan(): Promise<ReconstructedScanResponse | null> {
  // Joindre history + urls + broken_links pour reconstruire
  const query = `
    WITH last_scan AS (
      SELECT * FROM \`${projectId}.${dataset}.errors_404_history\`
      WHERE scan_date = (SELECT MAX(scan_date) FROM \`${projectId}.${dataset}.errors_404_history\`)
      LIMIT 1
    )
    SELECT 
      ls.id as scan_id,
      ls.scan_date,
      ls.sites_results,
      ARRAY_AGG(STRUCT(
        u.site,
        u.path
      )) as urls,
      ARRAY_AGG(STRUCT(
        bl.site,
        bl.source_url as source,
        bl.target_url as target
      )) as links
    FROM last_scan ls
    LEFT JOIN \`${projectId}.${dataset}.errors_404_urls\` u
      ON u.scan_id = ls.id
    LEFT JOIN \`${projectId}.${dataset}.broken_links\` bl
      ON bl.scan_id = ls.id
    GROUP BY ls.id, ls.scan_date, ls.sites_results
  `
  
  const [rows] = await bigquery.query({ query })
  return rows[0] as ReconstructedScanResponse | null
}
```

---

### Phase 2 : Migration du Code (Jour 2)

#### 2.1 Modifier `app/api/404/crawl/route.ts`

**Remplacer :**
```typescript
import { insertError404History, saveBrokenLinks, ... } from '@/lib/json-storage'
```

**Par :**
```typescript
import { 
  insertError404History, 
  insertError404UrlsScan, 
  insertBrokenLinksScan 
} from '@/lib/bigquery'
```

**Lignes 377-432 : Remplacer bloc de sauvegarde**
```typescript
// Enregistrer dans BigQuery (remplace JSON)
try {
  const scanId = randomUUID()
  const now = new Date().toISOString()
  
  console.log('💾 Enregistrement dans BigQuery...')
  
  // 1. Historique
  await insertError404History({
    id: scanId,
    scan_date: now,
    total_sites: results.length,
    total_pages_checked: totalPages,
    total_errors_404: totalErrors,
    sites_results: results.map(r => ({
      site: r.site,
      total_checked: r.total_checked,
      errors_404: r.errors_404,
    })),
    crawl_duration_seconds: totalDuration,
  })
  
  // 2. URLs 404/410 détaillées
  const urlEntries = results.flatMap(r =>
    (r.errors_detailed || []).map(e => ({ site: r.site, path: e.path, status: e.status }))
  )
  if (urlEntries.length > 0) {
    await insertError404UrlsScan({
      scan_id: scanId,
      scan_date: now,
      commit_sha,
      branch,
      actor,
      repo,
      entries: urlEntries,
    })
  }
  
  // 3. Liens cassés visibles
  const brokenLinksEntries = results.flatMap(r =>
    (r.broken_links_list || []).map(l => ({ site: r.site, source: l.source, target: l.target }))
  )
  if (brokenLinksEntries.length > 0) {
    await insertBrokenLinksScan({
      scan_id: scanId,
      scan_date: now,
      commit_sha,
      branch,
      actor,
      repo,
      links: brokenLinksEntries,
    })
  }
  
  console.log(`✅ Scan enregistré dans BigQuery (ID: ${scanId})`)
} catch (error: any) {
  console.error('⚠️ Erreur BigQuery:', error.message)
  // Ne pas faire échouer le crawl si BQ échoue
}
```

#### 2.2 Modifier `/api/404/history/route.ts`

**Remplacer :**
```typescript
import { getError404Evolution, getLastError404Scan, getLastScansAsEvolution } from '@/lib/json-storage'
```

**Par :**
```typescript
import { getError404Evolution, getLastError404Scan, getLastScansAsEvolution } from '@/lib/bigquery'
```

#### 2.3 Modifier `/api/404/last/route.ts`

**Remplacer :**
```typescript
import { getLastReconstructedScan } from '@/lib/json-storage'
```

**Par :**
```typescript
import { getLastReconstructedScan } from '@/lib/bigquery'
```

#### 2.4 Modifier `/api/404/delta/route.ts`

**Remplacer :**
```typescript
import { getBrokenLinksDelta, getError404Delta } from '@/lib/json-storage'
```

**Par :**
```typescript
import { getBrokenLinksDelta, getError404Delta } from '@/lib/bigquery'
```

---

### Phase 3 : Migration des Données & Tests (Jour 3)

#### 3.1 Script de migration JSON → BigQuery

**Créer `scripts/migrate-json-to-bigquery.ts` :**
```typescript
import { readFileSync } from 'fs'
import { join } from 'path'
import { 
  insertError404History, 
  insertError404UrlsScan, 
  insertBrokenLinksScan 
} from '../dashboard/lib/bigquery'

async function main() {
  // 1. Lire fichiers JSON existants
  const historyPath = join(__dirname, '../dashboard/data/errors-404-history.json')
  const urlsPath = join(__dirname, '../dashboard/data/errors-404-urls.json')
  const linksPath = join(__dirname, '../dashboard/data/broken-links-scans.json')
  
  const history: any[] = JSON.parse(readFileSync(historyPath, 'utf-8'))
  const urls: any[] = JSON.parse(readFileSync(urlsPath, 'utf-8'))
  const links: any[] = JSON.parse(readFileSync(linksPath, 'utf-8'))
  
  console.log(`📦 Migrant ${history.length} scans historiques...`)
  
  // 2. Insérer dans BigQuery par batch
  for (const h of history) {
    try {
      await insertError404History(h)
      console.log(`✅ Historique ${h.id}`)
    } catch (error: any) {
      console.error(`❌ Erreur ${h.id}:`, error.message)
    }
  }
  
  console.log(`📦 Migrant ${urls.length} scans d'URLs...`)
  for (const u of urls) {
    try {
      await insertError404UrlsScan(u)
      console.log(`✅ URLs ${u.scan_id}`)
    } catch (error: any) {
      console.error(`❌ Erreur ${u.scan_id}:`, error.message)
    }
  }
  
  console.log(`📦 Migrant ${links.length} scans de liens cassés...`)
  for (const l of links) {
    try {
      await insertBrokenLinksScan(l)
      console.log(`✅ Liens ${l.scan_id}`)
    } catch (error: any) {
      console.error(`❌ Erreur ${l.scan_id}:`, error.message)
    }
  }
  
  console.log('✅ Migration terminée')
}

main()
```

**Exécuter :**
```bash
cd dashboard
npm install -D tsx
tsx scripts/migrate-json-to-bigquery.ts
```

#### 3.2 Tests de validation

**Checklist :**
- [ ] Vérifier que BigQuery contient les données migrées
- [ ] Tester `/api/404/history` → retourne données BigQuery
- [ ] Tester `/api/404/last` → retourne scan reconstruit
- [ ] Tester `/api/404/delta` → calcule delta correctement
- [ ] Lancer nouveau crawl → écrit dans BigQuery uniquement

#### 3.3 Nettoyage

**Après validation :**
1. Sauvegarder JSON actuels
```bash
mv dashboard/data/errors-404-history.json dashboard/data/errors-404-history.json.backup
mv dashboard/data/errors-404-urls.json dashboard/data/errors-404-urls.json.backup
mv dashboard/data/broken-links.json dashboard/data/broken-links.json.backup
mv dashboard/data/broken-links-scans.json dashboard/data/broken-links-scans.json.backup
```

2. Supprimer `lib/json-storage.ts` (543 lignes)
```bash
rm dashboard/lib/json-storage.ts
```

3. Update imports dans code
```bash
# Trouver tous les imports restants
grep -r "from '@/lib/json-storage'" dashboard/app
# Supprimer ou commenter si nécessaire
```

---

## 🔍 VÉRIFICATIONS POST-MIGRATION

### 1. Cohérence des données
```bash
# Compter scans dans BQ
bq query --use_legacy_sql=false "
  SELECT COUNT(*) as total_scans 
  FROM \`moverz-dashboard.analytics_core.errors_404_history\`
"

# Compter URLs
bq query --use_legacy_sql=false "
  SELECT COUNT(*) as total_urls 
  FROM \`moverz-dashboard.analytics_core.errors_404_urls\`
"

# Compter liens cassés
bq query --use_legacy_sql=false "
  SELECT COUNT(*) as total_links 
  FROM \`moverz-dashboard.analytics_core.broken_links\`
"
```

### 2. Performance des requêtes
```bash
# Vérifier temps de réponse
curl -w "@curl-format.txt" "http://localhost:3000/api/404/history?days=30"
```

---

## ⚠️ ROLLBACK PLAN

En cas de problème :

1. **Restaurer code :**
```bash
git checkout main dashboard/lib/json-storage.ts
git checkout main dashboard/app/api/404/
```

2. **Restaurer données JSON :**
```bash
cp dashboard/data/*.backup dashboard/data/
```

3. **Redeploy**

---

## 📊 COÛT BIGQUERY

### Estimation mensuelle

**Données stockées :**
- 100 scans/mois × 200KB/scan ≈ 20 MB/mois
- 3 ans rétention × 100 scans/mois ≈ 3.6 GB
- **Coût stockage : $0.10/GB/mois = $0.36/mois**

**Requêtes :**
- 10K pages vues/mois × 3 requêtes/page ≈ 30K queries
- Slot-time estimé : 10 sec/page
- **Coût queries : $5 par TB traité ≈ $0.50/mois**

**Total estimé : < $1/mois** ✅

---

## ✅ CHECKLIST FINALE

### Avant migration
- [ ] Tables BigQuery créées
- [ ] `lib/bigquery.ts` complété
- [ ] Backup JSON existants
- [ ] Tests unitaires ajoutés

### Pendant migration
- [ ] Script migration exécuté
- [ ] Validation données
- [ ] Tests API
- [ ] Nettoyage code

### Après migration
- [ ] Surveillance 1 semaine
- [ ] Documentation mise à jour
- [ ] Formation équipe

---

**Estimation totale : 3 jours (1j préparation + 1j migration + 1j tests)**  
**Risque : Faible (rollback possible)**  
**Bénéfice : Énorme (maintenabilité ↑, cohérence ↑)**

