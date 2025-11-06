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
- Route retourne toujours 500
- Message générique "Erreur lors du lancement de l'ETL"
- Pas de détails sur l'erreur réelle

**Probable cause:**
- Variables d'environnement mal passées au processus enfant
- Ou chemin incorrect en production
- Ou `tsx` non disponible

---

## 🎯 Prochaines Étapes

1. **Améliorer la route API** pour logger l'erreur exacte
2. **Vérifier les logs serveur** en production
3. **Tester avec variables complètes** pour reproduire
4. **Ajouter validation** avant exécution

---

**Diagnostic complet effectué. Problème identifié mais nécessite amélioration du code pour diagnostiquer précisément.**

