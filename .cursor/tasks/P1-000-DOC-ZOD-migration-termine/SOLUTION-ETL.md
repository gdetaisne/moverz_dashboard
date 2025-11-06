# ✅ Solution Problème ETL /api/etl/run

**Date:** 2025-11-06  
**Tâche:** P1-000 (Tests en ligne)

---

## 🔍 Diagnostic Complet

### Ce que fait le bouton "Actualisation"

1. **Frontend** (`page.tsx`) :
   - Appelle `POST /api/etl/run`
   - Affiche popup selon résultat

2. **API Route** (`/api/etl/run/route.ts`) :
   - Calcule chemin vers `../etl/gsc/fetch-simple.ts`
   - Passe variables d'environnement
   - Exécute `npx tsx fetch-simple.ts`
   - Timeout 2 minutes

3. **Script ETL** :
   - Vérifie `GCP_SA_KEY_JSON` et `SITES_LIST` requis
   - Si manquants → `process.exit(1)` → API retourne 500

---

## 🔴 Problèmes Identifiés

### Problème #1: Gestion d'erreurs insuffisante

**Avant:**
- Erreur générique "Erreur lors du lancement de l'ETL"
- Pas de détails sur la cause
- Difficile à diagnostiquer

### Problème #2: Pas de validation pré-exécution

**Avant:**
- Exécute directement sans vérifier
- Pas de vérification que le fichier existe
- Pas de vérification des variables

### Problème #3: Logs insuffisants

**Avant:**
- Utilise `console.log` au lieu de logger structuré
- Pas de contexte dans les logs
- Difficile à tracer en production

---

## ✅ Solutions Implémentées

### 1. Validation Pré-Exécution

```typescript
// Vérifier que le fichier existe
if (!fs.existsSync(etlScript)) {
  return NextResponse.json({
    success: false,
    message: 'Script ETL non trouvé',
    error: `Le fichier ${etlScript} n'existe pas`,
  }, { status: 500 })
}

// Vérifier les variables critiques
const missingVars = Object.entries(requiredVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key)

if (missingVars.length > 0) {
  return NextResponse.json({
    success: false,
    message: 'Variables d\'environnement manquantes',
    error: `Variables requises: ${missingVars.join(', ')}`,
  }, { status: 500 })
}
```

**Avantages:**
- ✅ Erreur détectée avant exécution
- ✅ Message clair pour l'utilisateur
- ✅ Identification précise du problème

### 2. Logger Structuré

**Avant:**
```typescript
console.log('🚀 Lancement manuel de l\'ETL...')
```

**Après:**
```typescript
logger.info('[etl/run] Lancement manuel de l\'ETL demandé')
logger.debug('[etl/run] Chemins calculés', { projectRoot, etlScript })
logger.error('[etl/run] Erreur', error, { errorDetails })
```

**Avantages:**
- ✅ Logs structurés avec contexte
- ✅ Facile à tracer en production
- ✅ Niveau de log configurable

### 3. Messages d'erreur explicites

**Avant:**
```typescript
message: 'Erreur lors du lancement de l\'ETL'
```

**Après:**
```typescript
// Messages spécifiques selon le type d'erreur
if (error.message?.includes('Command failed')) {
  userMessage = 'Le script ETL a échoué. Vérifiez les logs serveur.'
} else if (error.message?.includes('timeout')) {
  userMessage = 'Le script ETL a dépassé le temps limite (2 minutes)'
} else if (error.message?.includes('ENOENT')) {
  userMessage = 'Script ETL ou dépendance non trouvé(e)'
}
```

**Avantages:**
- ✅ Utilisateur comprend mieux le problème
- ✅ Action correctrice suggérée

### 4. Extraction détails erreur

**Avant:**
```typescript
error: error.message
```

**Après:**
```typescript
const errorDetails = {
  message: error.message,
  code: error.code,
  signal: error.signal,
  stderr: error.stderr,  // ← Détails du script ETL
  stdout: error.stdout,
}
```

**Avantages:**
- ✅ Voir l'erreur exacte du script ETL
- ✅ Debugging facilité

---

## 🧪 Tests Effectués

### Test 1: Validation fichier manquant
```typescript
// Si fichier n'existe pas
→ Status 500
→ Message: "Script ETL non trouvé"
→ Détails: chemin exact dans response
```

### Test 2: Validation variables manquantes
```typescript
// Si GCP_SA_KEY_JSON manquant
→ Status 500
→ Message: "Variables d'environnement manquantes"
→ Détails: ["GCP_SA_KEY_JSON"]
```

### Test 3: Exécution réelle
```typescript
// Si tout OK mais script échoue
→ Status 500
→ Message: "Le script ETL a échoué"
→ Détails: stderr dans logs serveur
```

---

## 📊 Comparaison Avant/Après

| Aspect | Avant | Après |
|--------|-------|-------|
| Validation | ❌ Aucune | ✅ Fichier + Variables |
| Logs | ❌ console.log | ✅ Logger structuré |
| Messages erreur | ❌ Générique | ✅ Spécifiques |
| Détails erreur | ❌ Message seulement | ✅ Code, stderr, stdout |
| Debugging | ❌ Difficile | ✅ Facilité |

---

## 🎯 Prochaines Étapes

### Pour diagnostiquer en production

1. **Déployer cette amélioration**
   - Les logs seront plus détaillés
   - Les messages d'erreur seront plus clairs

2. **Tester le bouton en production**
   - Vérifier les logs serveur
   - Voir le message d'erreur exact

3. **Selon l'erreur, corriger:**
   - Si "Script ETL non trouvé" → Vérifier structure Docker
   - Si "Variables manquantes" → Vérifier config production
   - Si "Script ETL a échoué" → Vérifier stderr dans logs

---

## 🔧 Améliorations Futures Possibles

1. **Async/Background Job**
   - Au lieu de bloquer la requête pendant 2 min
   - Lancer en background et retourner immédiatement
   - Endpoint pour checker le status

2. **Cache ETL**
   - Éviter de relancer si déjà lancé récemment
   - Lock pour éviter double exécution

3. **Health Check**
   - Endpoint pour vérifier si ETL peut être lancé
   - Vérifier fichier, variables, dépendances

---

**Solution implémentée. Route améliorée avec meilleure gestion d'erreurs et diagnostic.**

