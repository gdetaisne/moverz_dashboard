# 🤔 BigQuery : Explication Simple pour Débutant

**BigQuery, c'est quoi ?**  
C'est une **base de données dans le cloud** de Google, comme un "Excel géant" qui peut stocker des **millions de lignes** et les interroger très rapidement.

---

## 🗃️ Analogue Excel

### Excel
- Tu as des **feuilles** (sheets)
- Chaque feuille a des **colonnes** (nom, date, prix...)
- Tu tapes des **données** dedans
- Tu peux faire des **filtres/tri/formules**

### BigQuery
- Tu as des **tables** (comme les feuilles)
- Chaque table a des **colonnes** (même principe)
- Tu **insères des données** (JSON, CSV, ou via code)
- Tu peux faire des **requêtes SQL** (comme des formules complexes)

---

## 🔧 Créer une Table : Ultra Simple

### En Excel
```
1. Ouvre Excel
2. Clic droit → Nouvelle feuille
3. Ecris les titres : Nom | Date | Prix
4. C'est tout !
```

### En BigQuery
```sql
CREATE TABLE ma_table (
  nom STRING,     -- texte
  date TIMESTAMP, -- date/heure
  prix INT64      -- nombre entier
);
```

**C'est pareil !** Tu définis juste les colonnes et leurs types.

---

## 💡 Exemple Concret : Pourquoi BigQuery dans Moverz ?

### Avant (JSON local)
```json
// data/errors-404.json
[
  { "site": "marseille.fr", "date": "2025-01-01", "erreurs": 5 },
  { "site": "lyon.fr", "date": "2025-01-01", "erreurs": 3 }
]
```

**Problèmes :**
- ❌ Fichier qui grossit → lent
- ❌ Difficile de chercher
- ❌ Pas de "formules" automatiques
- ❌ Pas de sauvegarde cloud

### Après (BigQuery)
```sql
CREATE TABLE errors_404_history (
  site STRING,
  date TIMESTAMP,
  erreurs INT64
)
PARTITION BY DATE(date);  -- Divise par date (comme un onglet par mois)
```

**Avantages :**
- ✅ Millions de lignes sans ralentissement
- ✅ Recherche ultra-rapide
- ✅ Requêtes SQL puissantes
- ✅ Sauvegarde automatique cloud
- ✅ Peut **auto-supprimer** les vieilles données (ex: après 2 ans)

---

## 🎯 Les Fonctionnalités Magiques

### 1️⃣ Partitionnement (Divise les Données)

**Sans partitionnement :**  
Toute la table = 1 gros bloc → lent

**Avec partitionnement :**
```
Table: errors_404_history
├── 2024-01-01 (1000 lignes)
├── 2024-01-02 (1000 lignes)
├── 2024-01-03 (1000 lignes)
└── ...
```

Quand tu cherches "données du 2 janvier", BigQuery lit **seulement** cette partition ! ⚡

```sql
-- Ligne magique dans la création de table
PARTITION BY DATE(scan_date)
```

### 2️⃣ Clustering (Organise par Colonnes)

**Sans clustering :**  
Recherche "marseille" → lit **toute** la table

**Avec clustering :**
```
Données triées par [site, date]
├── marseille.fr
│   ├── 2024-01-01
│   ├── 2024-01-02
├── lyon.fr
│   ├── 2024-01-01
│   ├── 2024-01-02
```

Quand tu cherches "marseille", va directement dans la zone "marseille" ! ⚡

```sql
-- Ligne magique
CLUSTER BY site, scan_date
```

### 3️⃣ Expiration Automatique

**Tu veux garder seulement 2 ans ?**

```sql
OPTIONS(
  partition_expiration_days=730  -- 2 ans
)
```

BigQuery **supprime automatiquement** les données > 2 ans ! 🧹

---

## 📊 Créer plusieurs Tables : Facile

### Migration 004 : Table Historique

```sql
-- Table principale
CREATE TABLE errors_404_history (
  id STRING NOT NULL,
  scan_date TIMESTAMP NOT NULL,
  total_sites INT64 NOT NULL,
  total_pages_checked INT64 NOT NULL,
  total_errors_404 INT64 NOT NULL,
  sites_results JSON NOT NULL,  -- JSON stocké tel quel !
  crawl_duration_seconds INT64 NOT NULL
) PARTITION BY DATE(scan_date)          -- ⚡ Magie 1
CLUSTER BY scan_date                    -- ⚡ Magie 2
OPTIONS(
  partition_expiration_days=730         -- ⚡ Magie 3
);
```

**Explication ligne par ligne :**
- `id STRING` → texte unique (ex: "scan-123")
- `scan_date TIMESTAMP` → date/heure du scan
- `total_sites INT64` → nombre entier (11 sites)
- `sites_results JSON` → données complexes en format JSON
- `PARTITION BY DATE(scan_date)` → divise par date
- `CLUSTER BY scan_date` → tri par date
- `partition_expiration_days=730` → supprime après 2 ans

### Migration 006 : Table URLs Détaillées

```sql
-- Table pour stocker chaque URL cassée
CREATE TABLE errors_404_urls (
  scan_id STRING NOT NULL,
  site STRING NOT NULL,
  path STRING NOT NULL,      -- ex: "/contact/old-page"
  status STRING NOT NULL     -- "404" ou "410"
) PARTITION BY DATE(scan_date)
CLUSTER BY site, path
OPTIONS(
  partition_expiration_days=730
);
```

**C'est pareil !** Juste des colonnes différentes.

---

## 🚀 Comment Utiliser BigQuery ?

### Option 1 : Interface Web

1. Va sur [console.cloud.google.com](https://console.cloud.google.com)
2. BigQuery → Queries → Write SQL
3. Tape :
```sql
SELECT * FROM moverz.errors_404_history
WHERE scan_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
```

### Option 2 : Code (TypeScript)

```typescript
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery({
  projectId: 'moverz-dashboard',
  credentials: {...}  // Clé API
})

// Insérer des données
await bigquery.query({
  query: `
    INSERT INTO errors_404_history 
    VALUES ('scan-123', '2025-01-01', 11, 1000, 5)
  `
})

// Lire des données
const [rows] = await bigquery.query({
  query: `SELECT * FROM errors_404_history LIMIT 10`
})
```

---

## 💰 Combien ça Coûte ?

### Stockage
- **$0.020/GB/mois** (après 10GB gratuits)

**Exemple Moverz :**
- 100MB de données/jour
- 100MB × 365 jours = **36.5 GB/an**
- Coût : **36.5 × $0.020 = $0.73/an** 🎉

### Requêtes
- **$5 par TB** de données lues

**Exemple Moverz :**
- 10K pages/mois × 50KB/page = **500MB/mois lus**
- Coût : **$0.0025/mois** 🎉

**Total : < $1/mois** pour Moverz !

---

## 🎓 Résumé

### BigQuery c'est :
1. ✅ **Simple** : Comme Excel, mais dans le cloud
2. ✅ **Puissant** : Millions de lignes sans problème
3. ✅ **Automatique** : Partitionnement, clustering, expiration
4. ✅ **Pas cher** : < $1/mois pour Moverz

### Pour Moverz :
- Stocke l'historique des 404
- Calculs de delta (nouvelles vs corrigées)
- Évolution temporelle
- Tous dans le cloud → accessible partout

### Tu peux créer plusieurs tables facilement :
```sql
CREATE TABLE table1 (...);
CREATE TABLE table2 (...);
CREATE TABLE table3 (...);
```

C'est comme créer plusieurs feuilles Excel !

---

## 📚 Ressources

- **Console BigQuery** : [console.cloud.google.com/bigquery](https://console.cloud.google.com/bigquery)
- **Tutoriel SQL** : [cloud.google.com/bigquery/docs](https://cloud.google.com/bigquery/docs)
- **Pricing** : [cloud.google.com/bigquery/pricing](https://cloud.google.com/bigquery/pricing)

