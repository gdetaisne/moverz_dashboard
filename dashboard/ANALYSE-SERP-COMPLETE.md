# 🔍 ANALYSE COMPLÈTE : Système SERP Preview

**Date :** 2025-01-XX  
**Objectif :** Documenter le fonctionnement complet de la détection de fiabilité et d'intent

---

## 📊 Éléments Affichés dans le Preview SERP

D'après l'exemple d'affichage, voici ce qui est détecté et affiché :

### 1. ✅ Badge de Fiabilité

**Affichage :** `✓ Fiable` (vert), `⚠ Partiel` (jaune), `✗ Incertain` (rouge)

**Calcul :** `calculateReliability()` dans `dashboard/app/serp/page.tsx:672-683`

```typescript
function calculateReliability(preview: SerpPreview): 'high' | 'medium' | 'low' {
  let score = 0
  
  if (preview.fetchSuccess) score += 40      // Fetch HTTP réussi
  if (preview.title && preview.description) score += 30  // Title + Description présents
  if (!preview.fetchRedirected) score += 20   // Pas de redirection
  if (preview.fetchStatusCode === 200) score += 10  // Status HTTP 200
  
  if (score >= 80) return 'high'      // ✓ Fiable
  if (score >= 50) return 'medium'    // ⚠ Partiel
  return 'low'                        // ✗ Incertain
}
```

**Score maximum :** 100 points
- **≥80 points** : ✓ Fiable (vert)
- **50-79 points** : ⚠ Partiel (jaune)
- **<50 points** : ✗ Incertain (rouge)

---

### 2. 🎯 Détection d'Intent

**Affichage :** Badge avec intent + source
- Exemple : `🎯 transactional (déduit, non présent dans JSON)`

**Logique de détection :** `inferIntentFromContent()` dans `dashboard/app/api/serp/preview/route.ts:52-84`

#### Ordre de priorité :
1. **Intent déclaré** (meta tag ou JSON-LD) → `intentDeclared`
2. **Intent déduit** (analyse du contenu) → `intentInferred`
3. **Intent final** : déclaré si disponible, sinon déduit

#### Patterns de détection (transactional) :
```typescript
/devis|prix|tarif|tarifs|acheter|commander|reserver|estimation|demander|formulaire|contact/
```

**Sources d'intent :**
- `meta` : `<meta name="intent" content="...">` ou `<meta name="search-intent" content="...">`
- `jsonld` : Champ `intent` ou `searchIntent` dans JSON-LD
- `inferred` : Détecté via regex sur URL + titre + description

**Affichage dans l'UI :**
```typescript
{row.intentSource === 'meta' && '(meta tag)'}
{row.intentSource === 'jsonld' && '(présent dans JSON-LD)'}
{row.intentSource === 'inferred' && '(déduit, non présent dans JSON)'}
```

---

### 3. 📋 Extraction des Données SERP

**Fonction :** `parseHtmlForSerp()` dans `dashboard/app/api/serp/preview/route.ts:117-252`

#### Données extraites :
- **Title** : `<title>` tag
- **Description** : `<meta name="description" content="...">`
- **Favicon** : `<link rel="icon">`
- **Rich Results** (JSON-LD) :
  - `hasFAQ` : `@type` contient "faqpage"
  - `hasAggregateRating` : Présence de `aggregateRating`
  - `hasBreadcrumb` : `@type` contient "breadcrumblist"
  - `hasHowTo` : `@type` contient "howto"
  - `hasArticle` : `@type` contient "article" ou "blogposting"
  - `hasVideo` : `@type` contient "videoobject"
  - `hasLocalBusiness` : `@type` contient "localbusiness"

---

## 🔄 Flux Complet de Données

```
1. API GET /api/serp/preview?site=...&limit=20
   ↓
2. Récupération Top Pages depuis BigQuery (getTopPages)
   - Impressions GSC sur 30 jours
   - CTR et Position
   ↓
3. Fetch HTTP parallèle (concurrency: 5, timeout: 5s)
   - Pour chaque URL du top
   - Extraction HTML
   ↓
4. Parsing HTML (parseHtmlForSerp)
   - Title, Description, Favicon
   - JSON-LD (Rich Results)
   - Meta tags (intent déclaré)
   ↓
5. Détection Intent
   - Intent déclaré (meta/JSON-LD)
   - Intent déduit (regex sur contenu)
   - Intent final = déclaré || déduit
   ↓
6. Calcul Scores
   - Reliability (fetch, title, desc, redirect, status)
   - Intent Match Score (déclaré vs déduit)
   - Length Score (title ≤55, desc ≤150)
   - Rich Results Score (7 types possibles)
   ↓
7. Snapshot BigQuery (non-bloquant)
   - Table: serp_snapshots
   - Toutes les métriques sauvegardées
   ↓
8. Affichage UI
   - Badge fiabilité (✓/⚠/✗)
   - Badge intent avec source
   - Preview SERP complet
```

---

## 📊 Métadonnées de Fiabilité

**Champs dans SerpPreview :**
- `fetchSuccess: boolean` → Fetch HTTP réussi
- `fetchStatusCode: number | null` → Code HTTP (200, 404, etc.)
- `fetchRedirected: boolean` → Redirection détectée
- `lastFetched: number` → Timestamp du dernier fetch

**Impact sur le score :**
- Fetch réussi : +40 points
- Title + Description : +30 points
- Pas de redirection : +20 points
- Status 200 : +10 points

---

## 🎯 Détection d'Intent Détaillée

### Intent Declared (Explicite)

**Source 1 : Meta Tag**
```html
<meta name="intent" content="transactional">
<!-- ou -->
<meta name="search-intent" content="transactional">
```

**Source 2 : JSON-LD**
```json
{
  "@type": "WebPage",
  "intent": "transactional",
  // ou
  "searchIntent": "transactional"
}
```

**Priorité :** Meta tag > JSON-LD

### Intent Inferred (Déduit)

**Regex patterns :**

1. **Transactional** (priorité)
   ```
   devis|prix|tarif|tarifs|acheter|commander|reserver|estimation|demander|formulaire|contact
   ```

2. **Commercial**
   ```
   comparer|meilleur|meilleurs|avis|test|top|choisir
   ```

3. **Informational**
   ```
   guide|comment|qu'est-ce|pourquoi|tutoriel|article|blog|conseil|astuce
   ```

4. **Navigational** (détection fine)
   ```
   URL contient: contact|accueil|home|index|a-propos|about
   ET profondeur ≤ 2 niveaux
   ```

**Ordre de recherche :**
- Transactional → Commercial → Informational → Navigational

### Intent Match Score

**Calcul :** `calculateIntentMatchScore()` ligne 86-92

```typescript
- Intent déclaré ET déduit identiques → 100% (match parfait)
- Intent déclaré ET déduit différents → 0% (mismatch)
- Pas d'intent déclaré OU déduit → 50% (incertain)
```

**Affichage :** Si score < 100 et les deux existent, affiche :
```
⚠️ Mismatch déclaré vs déduit
```

---

## ✅ Vérification de Cohérence

### Dans l'image affichée :
- ✓ Badge "Fiable" → Score ≥80 (tous les critères remplis)
- 🎯 Intent "transactional" → Détecté via regex (devis/tarif dans le contenu)
- Label "(déduit, non présent dans JSON)" → `intentSource === 'inferred'`

### Code correspondant :
```typescript
// Ligne 568: dashboard/app/serp/page.tsx
{row.intentSource === 'inferred' && '(déduit, non présent dans JSON)'}

// Ligne 64-65: dashboard/app/api/serp/preview/route.ts
if (/devis|prix|tarif|tarifs|.../.test(allText)) {
  return 'transactional'
}
```

**✅ COHÉRENCE CONFIRMÉE**

---

## 🔧 Points d'Amélioration Potentiels

### 1. Intent Inferred peut être amélioré

**Problème actuel :**
- Patterns regex simples peuvent donner des faux positifs
- Pas de contexte sémantique

**Amélioration possible :**
- Utiliser un modèle NLP léger (optionnel)
- Poids différents selon la source (URL > Title > Description)

### 2. Reliability Score pourrait inclure d'autres facteurs

**Actuellement :**
- Fetch success
- Title + Description
- Redirection
- Status code

**Pourrait ajouter :**
- Temps de réponse (latence)
- Validité SSL
- Taille du contenu
- Encodage charset

### 3. Intent Match Score binaire

**Actuellement :**
- Match parfait = 100%
- Mismatch = 0%
- Incertain = 50%

**Pourrait être :**
- Score de similarité sémantique (transactional ≈ commercial)
- Distance de Levenshtein pour typos

---

## 📈 Métriques Disponibles

Toutes ces données sont sauvegardées dans `serp_snapshots` :

- **Performance GSC :** impressions, clicks, CTR, position, share_pct
- **Intent :** intent, intent_declared, intent_inferred, intent_source, intent_match_score
- **Scores :** score_length, score_rich_results
- **Rich Results :** FAQ, Rating, Breadcrumb, HowTo, Article, Video, LocalBusiness
- **Fiabilité :** fetch_success, fetch_status_code, fetch_redirected

**Utilisation :**
- Tracking de l'évolution dans le temps
- Calcul de benchmarks CTR par intent
- Détection de régressions (scores qui baissent)

---

## 🎯 Conclusion

Le système fonctionne correctement :
- ✅ Fiabilité calculée selon 4 critères (100 points max)
- ✅ Intent détecté via déclaré (meta/JSON-LD) ou déduit (regex)
- ✅ Source d'intent affichée clairement
- ✅ Match score pour valider cohérence déclaré vs déduit
- ✅ Toutes les métriques sauvegardées dans BigQuery

L'affichage dans l'image correspond parfaitement au code actuel.

