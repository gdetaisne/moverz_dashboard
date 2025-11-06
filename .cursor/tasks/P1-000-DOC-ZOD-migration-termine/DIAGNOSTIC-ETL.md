# 🔍 Diagnostic - Problème ETL /api/etl/run

**Date:** 2025-11-06  
**Tâche:** P1-000 (Tests en ligne)

---

## 📋 Flux Complet du Bouton "Actualisation"

### 1. Frontend (`app/page.tsx`)

**Fonction `runETL()`:**
```typescript
const response = await fetch('/api/etl/run', { method: 'POST' })
const result = await response.json()

if (result.success) {
  alert('✅ Données actualisées avec succès !')
  await fetchData() // Recharge les données
} else {
  alert('❌ Erreur lors de l\'actualisation : ' + result.message)
}
```

---

### 2. API Route (`app/api/etl/run/route.ts`)

**Ce qu'elle fait:**
1. Calcule le chemin: `path.resolve(process.cwd(), '..')` + `etl/gsc/fetch-simple.ts`
2. Prépare les variables d'environnement
3. Exécute: `npx tsx ${etlScript}` avec timeout 2 minutes
4. Retourne le résultat

**Problème potentiel:**
- Si `exec()` échoue → catch → retourne 500 avec message d'erreur

---

### 3. Script ETL (`etl/gsc/fetch-simple.ts`)

**Validation au démarrage:**
```typescript
if (!config.gcpSaKeyJson) {
  logger.error('GCP_SA_KEY_JSON is required')
  process.exit(1)  // ← EXIT CODE 1
}

if (!config.sitesList) {
  logger.error('SITES_LIST is required')
  process.exit(1)  // ← EXIT CODE 1
}
```

**Si validation échoue:** Le script fait `process.exit(1)`, ce qui fait échouer `execAsync()`.

---

## 🔴 Problème Identifié

### Cause Probable #1: Variables d'environnement non passées

**Hypothèse:** Les variables `GCP_SA_KEY_JSON` ou `SITES_LIST` ne sont pas correctement passées au script ETL.

**Vérification dans le code:**
```typescript
// Route API passe:
if (process.env.GCP_SA_KEY_JSON) envVars['GCP_SA_KEY_JSON'] = process.env.GCP_SA_KEY_JSON
if (process.env.SITES_LIST) envVars['SITES_LIST'] = process.env.SITES_LIST
```

**⚠️ Problème:** Si ces variables ont des caractères spéciaux (JSON avec sauts de ligne), elles peuvent ne pas être correctement passées via `env` dans `exec()`.

---

### Cause Probable #2: Chemin incorrect en production

**En local:**
- `process.cwd()` = `/Users/guillaumestehelin/moverz_dashboard-2/dashboard`
- `projectRoot` = `/Users/guillaumestehelin/moverz_dashboard-2`
- ✅ Chemin correct

**En production (Docker/conteneur):**
- Structure peut être différente
- Le dossier `etl/` peut ne pas être accessible depuis le conteneur dashboard
- Le chemin relatif `../etl/` peut pointer vers un endroit inexistant

---

### Cause Probable #3: Dépendances manquantes

**tsx peut ne pas être disponible:**
- Non installé dans le conteneur
- Pas dans le PATH
- Version incompatible

---

## 🧪 Tests Effectués

### ✅ Ce qui fonctionne
- Chemin calculé correctement en local
- Fichier ETL existe à l'emplacement attendu
- `tsx` disponible et fonctionnel
- Structure projet correcte

### ❌ Ce qui échoue
- Script ETL exit avec code 1 si variables manquantes
- Variables d'environnement pas dans le shell local (normal)
- Exécution depuis API route retourne erreur

---

## 🔧 Solutions Possibles

### Solution 1: Améliorer gestion d'erreurs

**Actuel:**
```typescript
catch (error: any) {
  return NextResponse.json({
    success: false,
    message: 'Erreur lors du lancement de l\'ETL',
    error: error.message,
  }, { status: 500 })
}
```

**Amélioration:**
- Logger `stderr` complet pour voir l'erreur exacte
- Retourner un message plus descriptif selon le type d'erreur
- Vérifier si le fichier existe avant d'exécuter

### Solution 2: Vérifier variables avant exécution

```typescript
// Vérifier que les variables critiques sont présentes
if (!process.env.GCP_SA_KEY_JSON) {
  return NextResponse.json({
    success: false,
    message: 'GCP_SA_KEY_JSON non configuré',
  }, { status: 500 })
}
```

### Solution 3: Logger détaillé

Ajouter des logs avant l'exécution pour diagnostiquer:
- Variables présentes ou non
- Chemin calculé exact
- Commande complète qui sera exécutée

---

## 📊 État Actuel

**En production:**
- Route retournait 500 toutes les fois
- Message générique "Erreur lors du lancement de l'ETL"
- Pas de détails sur l'erreur réelle

**Cause identifiée (via logs serveur):**
- Le script ETL retourne `exitCode: 2` pour "succès partiel" (10/11 sites réussissent)
- L'API `/api/etl/run` considérait tout code ≠ 0 comme une erreur
- Donc même avec succès partiel, l'API retournait 500

**Solution appliquée:**
- Modifié l'API pour accepter le code `2` comme succès partiel
- Le code `2` retourne maintenant `success: true` avec un message informatif
- Extraction des stats depuis le stdout JSON pour afficher les résultats
- Code `1` = échec complet (toujours considéré comme erreur)

---

## ✅ Solution Implémentée

### Changements dans `/api/etl/run`

1. **Gestion des codes de sortie** :
   - `0` = Succès complet → `success: true`
   - `2` = Succès partiel → `success: true` avec message informatif
   - `1` = Échec complet → `success: false` (500)

2. **Extraction des stats** :
   - Parse le stdout JSON pour extraire les stats de l'ETL
   - Affiche `X/Y sites réussis` dans le message de succès

3. **Messages améliorés** :
   - Succès partiel : "ETL terminé avec succès partiel (10/11 sites réussi)"
   - Inclut un warning si certains sites ont échoué

---

## 🎯 Tests à Effectuer

1. **Tester en production** avec le bouton "Actualisation"
2. **Vérifier que** :
   - Le message de succès s'affiche correctement
   - Les stats sont affichées (X/Y sites)
   - Aucune pop-up d'erreur si succès partiel
3. **Vérifier les logs** pour confirmer le comportement

---

## ✅ Tests en Production

**Date:** 2025-11-06  
**Résultat:** ✅ **SUCCÈS**

- Le bouton "Actualisation" fonctionne correctement
- Pop-up affiche "Données actualisées avec succès !"
- Plus d'erreur 500 lors des succès partiels
- Le fix résout complètement le problème initial

**Note:** Une erreur 404 est visible dans la console (`/404?rsc=19zvn`), mais c'est un problème séparé non lié à l'ETL.

---

**✅ SOLUTION APPLIQUÉE ET VALIDÉE : L'API accepte maintenant les succès partiels (code 2) comme des succès.**

