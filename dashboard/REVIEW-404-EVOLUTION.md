# 🔍 Revue du Fonctionnement : Évolution des Erreurs 404

**Date :** 2025-01-XX  
**Composant :** `Error404Evolution.tsx` + API `/api/404/history`

---

## 📊 Flux de Données Complet

```
1. Page 404 charge au montage
   ↓
2. loadHistory() → fetch('/dashboard-api/404/history?days=30')
   ↓
3. API Route: GET /api/404/history
   - Paramètres par défaut: days=30, count=20, mode='last'
   ↓
4. Mode 'last' → getLastScansAsEvolution(20)
   - Récupère les 20 derniers scans individuels
   - Format: scan_date au format ISO avec heure
   ↓
5. Mode 'evolution' → getError404Evolution(30)
   - Agrège par jour (GROUP BY DATE)
   - Format: date au format ISO à 00:00:00
   ↓
6. Données retournées au frontend
   ↓
7. Composant Error404Evolution affiche le graphique
```

---

## ✅ Points Positifs

### 1. Architecture
- ✅ Séparation claire entre scans individuels (`mode=last`) et agrégation quotidienne (`mode=evolution`)
- ✅ Gestion d'erreur robuste : retourne toujours `success: true` avec données vides en cas d'erreur
- ✅ Format de dates ISO compatible avec `date-fns.parseISO`

### 2. Requêtes BigQuery
- ✅ Formatage explicite des dates avec `FORMAT_TIMESTAMP`
- ✅ Conversion explicite des types avec `CAST(...AS INT64)`
- ✅ Mapping des résultats pour garantir types JavaScript corrects

### 3. Composant UI
- ✅ Gestion du cas vide avec message explicite
- ✅ Calcul de tendance (↑↓) basé sur premier vs dernier point
- ✅ Stats additionnelles (scans totaux, moyennes, durée)

---

## ⚠️ Problèmes Identifiés

### 1. Mode par défaut inadapté

**Problème :**
- Le frontend appelle `/dashboard-api/404/history?days=30` sans paramètre `mode`
- Par défaut, l'API utilise `mode='last'` qui retourne les **20 derniers scans individuels**
- Pour une "évolution", on devrait plutôt utiliser l'agrégation quotidienne

**Impact :**
- Si plusieurs scans sont faits le même jour, ils apparaissent tous séparément
- Le graphique montre des points multiples par jour plutôt qu'une courbe lissée
- Les valeurs min/max sont identiques (pas d'agrégation)

**Solution recommandée :**
```typescript
// Dans dashboard/app/404/page.tsx
const response = await fetch('/dashboard-api/404/history?days=30&mode=evolution')
```

### 2. Valeurs min/max identiques en mode 'last'

**Problème :**
Dans `getLastScansAsEvolution`, on utilise :
```sql
total_errors_404 as max_errors_404,
total_errors_404 as min_errors_404,
```
Pour un scan individuel, min = max = total, ce qui crée 3 lignes identiques dans le graphique.

**Impact :**
- Affichage confus : 3 courbes superposées
- Pas de valeur ajoutée à afficher min/max pour un scan individuel

**Solution :**
- En mode `last`, ne pas afficher les lignes min/max
- Ou calculer min/max sur les sites dans `sites_results`

### 3. Format de date incohérent

**Problème :**
- Mode `last` : `FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S')` → `2025-01-15T14:30:00`
- Mode `evolution` : `FORMAT_TIMESTAMP('%Y-%m-%dT00:00:00')` → `2025-01-15T00:00:00`

**Impact :**
- Tooltip affiche "HH:mm" mais en mode evolution c'est toujours 00:00
- Peut être confusant pour l'utilisateur

**Solution :**
- En mode evolution, formater le tooltip sans l'heure

### 4. Limite fixe non configurable

**Problème :**
- `getLastScansAsEvolution` utilise une limite fixe de 20 scans
- Le frontend ne peut pas la modifier via paramètre

**Solution :**
- Utiliser le paramètre `count` de l'API (déjà présent mais non utilisé)

### 5. Pas de rafraîchissement automatique

**Problème :**
- L'historique est chargé une seule fois au montage
- Si un nouveau scan est lancé, l'historique ne se met pas à jour

**Solution :**
- Ajouter un interval de rafraîchissement (comme pour `loadDelta` et `loadLastScan`)

---

## 🔧 Corrections Recommandées

### 1. Changer le mode par défaut

```typescript
// dashboard/app/404/page.tsx
async function loadHistory() {
  setLoadingHistory(true)
  try {
    // Utiliser mode=evolution pour agrégation quotidienne
    const response = await fetch('/dashboard-api/404/history?days=30&mode=evolution')
    // ...
  }
}
```

### 2. Adapter l'affichage selon le mode

```typescript
// dashboard/components/Error404Evolution.tsx
interface Error404EvolutionProps {
  data: Array<{...}>
  mode?: 'last' | 'evolution' // Nouveau prop
}

// Masquer min/max si mode='last'
{mode !== 'last' && (
  <>
    <Line dataKey="max_errors_404" ... />
    <Line dataKey="min_errors_404" ... />
  </>
)}
```

### 3. Améliorer le formatage des tooltips

```typescript
const formatTooltipDate = (dateStr: string) => {
  try {
    const date = parseISO(dateStr)
    // Si c'est à 00:00:00, ne pas afficher l'heure
    if (date.getHours() === 0 && date.getMinutes() === 0) {
      return format(date, 'd MMM yyyy', { locale: fr })
    }
    return format(date, "d MMM HH:mm", { locale: fr })
  } catch {
    return dateStr
  }
}
```

### 4. Utiliser le paramètre count

```typescript
// dashboard/lib/bigquery.ts
export async function getLastScansAsEvolution(limit: number = 20): Promise<Error404Evolution[]> {
  // limit est déjà utilisé, mais devrait venir du paramètre count de l'API
}
```

### 5. Ajouter rafraîchissement automatique

```typescript
// dashboard/app/404/page.tsx
useEffect(() => {
  loadHistory()
  loadDelta()
  loadLastScan()
  const id = setInterval(() => {
    loadDelta()
    loadLastScan()
    // Rafraîchir l'historique toutes les 5 minutes
    loadHistory()
  }, 5 * 60 * 1000) // 5 minutes
  return () => clearInterval(id)
}, [])
```

---

## 📋 Checklist de Vérification

- [ ] Vérifier que les données sont bien insérées dans `errors_404_history`
- [ ] Vérifier le format des dates retournées par BigQuery
- [ ] Tester avec plusieurs scans le même jour
- [ ] Tester avec scans sur plusieurs jours
- [ ] Vérifier l'affichage du graphique avec données réelles
- [ ] Vérifier le calcul de tendance
- [ ] Tester le mode `evolution` vs `last`

---

## 🎯 Recommandation Principale

**Changer le mode par défaut de `last` à `evolution`** pour une meilleure visualisation de l'évolution quotidienne plutôt que des scans individuels.

