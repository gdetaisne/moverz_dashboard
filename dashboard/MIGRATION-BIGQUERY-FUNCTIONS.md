# 🔧 Migration BigQuery : Compléter lib/bigquery.ts

**Objectif :** Ajouter toutes les fonctions manquantes pour remplacer json-storage.ts

---

## 📋 Fonctions à ajouter

### ✅ Déjà existantes
- `insertError404History()` ✅
- `getError404Evolution()` ✅
- `getLastError404Scan()` ✅

### ❌ Manquantes
- `insertError404UrlsScan()` ❌
- `insertBrokenLinksScan()` ❌
- `getError404Delta()` ❌
- `getBrokenLinksDelta()` ❌
- `getLastReconstructedScan()` ❌
- `getLastScansAsEvolution()` ❌

---

## 🎯 Plan d'ajout

Les fonctions seront ajoutées une par une dans lib/bigquery.ts.

