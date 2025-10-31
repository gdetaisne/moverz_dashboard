# 🎯 Plan d'Action : Améliorations SERP (Phases 1-3)

**Date** : 2025-01-03  
**Objectif** : Détecter 300+ pages mal optimisées et mesurer le ROI des optimisations

---

## 📊 Phase 1 : Intent Match Score + Rich Results + Length Score

**Durée estimée** : 2h dev  
**ROI** : Immédiat (détection automatique des problèmes)

### ✅ À implémenter

#### 1.1 Calcul Intent réel (déduit)
```typescript
function inferIntentFromContent(
  pageUrl: string, 
  title: string | null, 
  description: string | null
): string | null {
  // Ordre : URL > Titre > Description
  const urlLower = pageUrl.toLowerCase()
  const titleLower = (title || '').toLowerCase()
  const descLower = (description || '').toLowerCase()
  const allText = `${urlLower} ${titleLower} ${descLower}`
  
  // Transactional (prioritaire)
  if (/devis|prix|tarif|tarifs|acheter|commander|reserver|estimation|demander|formulaire|contact/.test(allText)) {
    return 'transactional'
  }
  
  // Commercial
  if (/comparer|meilleur|meilleurs|avis|test|top|choisir/.test(allText)) {
    return 'commercial'
  }
  
  // Informational
  if (/guide|comment|qu'est-ce|pourquoi|tutoriel|article|blog|conseil|astuce/.test(allText)) {
    return 'informational'
  }
  
  // Navigational (détection fine)
  if (/contact|accueil|home|index|a-propos|about/.test(urlLower) && urlLower.split('/').length <= 2) {
    return 'navigational'
  }
  
  return null // Incertain
}
```

#### 1.2 Intent Match Score
```typescript
function calculateIntentMatchScore(declared: string | null, inferred: string | null): number {
  if (!declared && !inferred) return 50 // Incertain (pas assez de données)
  if (!declared) return 50 // Intent non déclaré = incertain
  if (!inferred) return 50 // Impossible à déduire = incertain
  
  return declared.toLowerCase() === inferred.toLowerCase() ? 100 : 0
}
```

#### 1.3 Rich Results supplémentaires
```typescript
// Dans parseHtmlForSerp(), ajouter :
let hasHowTo = false
let hasArticle = false
let hasVideo = false
let hasLocalBusiness = false

// Dans la boucle JSON-LD :
if (type.includes('howto')) hasHowTo = true
if (type.includes('article') || type.includes('blogposting')) hasArticle = true
if (type.includes('videoobject')) hasVideo = true
if (type.includes('localbusiness')) hasLocalBusiness = true

// Score Rich Results (0-100)
const richResultsCount = [
  hasFAQ, hasAggregateRating, hasBreadcrumb,
  hasHowTo, hasArticle, hasVideo, hasLocalBusiness
].filter(Boolean).length

const scoreRichResults = (richResultsCount / 7) * 100
```

#### 1.4 Length Score (binaire conservateur)
```typescript
function calculateLengthScore(title: string | null, description: string | null): number {
  // Seuils conservateurs (éviter troncature)
  const TITLE_MAX = 55 // Google tronque souvent avant 60
  const DESC_MAX = 150 // Idem pour 155
  
  let titleOK = false
  let descOK = false
  
  if (title) {
    titleOK = title.length <= TITLE_MAX
  }
  
  if (description) {
    descOK = description.length <= DESC_MAX
  }
  
  // Binaire : 100% si les 2 OK, 0% si aucun, 50% si un seul ou incertain
  if (!title && !description) return 50 // Incertain
  if (titleOK && descOK) return 100
  if (!titleOK && !descOK) return 0
  return 50 // Un seul OK ou incertain
}
```

### 📝 Structure TypeScript
```typescript
type SerpPreview = {
  // ... existant
  intent: string | null
  intentDeclared: string | null
  intentInferred: string | null
  intentMatchScore: number // 0-100
  hasHowTo: boolean
  hasArticle: boolean
  hasVideo: boolean
  hasLocalBusiness: boolean
  scoreRichResults: number // 0-100
  scoreLength: number // 0-100 (binaire)
  ctr: number | null // Depuis GSC
  position: number | null // Depuis GSC
}
```

---

## 📊 Phase 2 : CTR Benchmarks dynamiques

**Durée estimée** : 1h dev  
**ROI** : Moyen (benchmarks réalistes basés sur vos données)

### ✅ À implémenter

#### 2.1 Calcul benchmarks depuis BigQuery
```typescript
async function getCTRBenchmarksByIntent(): Promise<Record<string, number>> {
  // Requête BigQuery : Top 10 pages par intent (30 derniers jours)
  const query = `
    WITH pages_with_intent AS (
      -- TODO: Requête depuis serp_snapshots ou join avec gsc_daily_metrics
      SELECT 
        intent,
        page,
        SUM(clicks) as total_clicks,
        SUM(impressions) as total_impressions,
        SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr
      FROM \`${dataset}.gsc_daily_metrics\` g
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND intent IS NOT NULL
      GROUP BY intent, page
    ),
    ranked_by_intent AS (
      SELECT 
        intent,
        page,
        ctr,
        ROW_NUMBER() OVER (PARTITION BY intent ORDER BY total_clicks DESC) as rank
      FROM pages_with_intent
    )
    SELECT 
      intent,
      AVG(ctr) as benchmark_ctr
    FROM ranked_by_intent
    WHERE rank <= 10
    GROUP BY intent
  `
  
  // Retourner : { transactional: 0.035, commercial: 0.040, ... }
}
```

**Note** : Cette requête nécessite que `intent` soit stocké dans BigQuery. Voir Phase 3.

#### 2.2 Score CTR vs Benchmark
```typescript
function calculateCTRScore(
  currentCTR: number | null,
  intent: string | null,
  benchmark: number | null
): number {
  if (!currentCTR || !intent || !benchmark) return 50 // Incertain
  
  const ratio = currentCTR / benchmark
  
  if (ratio >= 1.0) return 100 // Au-dessus du benchmark
  if (ratio >= 0.8) return 75  // Proche (80-100%)
  if (ratio >= 0.6) return 50  // En dessous (60-80%)
  return 25 // Très en dessous (<60%)
}
```

---

## 📊 Phase 3 : Stockage BigQuery + Tracking évolution

**Durée estimée** : 3h dev  
**ROI** : Long terme (prouve ROI optimisations)

### ✅ Migration BigQuery

#### 3.1 Table `serp_snapshots`
```sql
CREATE TABLE IF NOT EXISTS `analytics_core.serp_snapshots` (
  snapshot_date DATE NOT NULL,
  url STRING NOT NULL,
  domain STRING NOT NULL,
  
  -- Métadonnées SERP
  intent_declared STRING,
  intent_inferred STRING,
  intent_match_score INT64, -- 0-100
  title STRING,
  description STRING,
  title_length INT64,
  desc_length INT64,
  
  -- Rich Results
  has_faq BOOL,
  has_rating BOOL,
  has_breadcrumb BOOL,
  has_howto BOOL,
  has_article BOOL,
  has_video BOOL,
  has_localbusiness BOOL,
  score_rich_results INT64, -- 0-100
  
  -- Scores
  score_length INT64, -- 0-100 (binaire)
  
  -- Métriques GSC (30j)
  impressions INT64,
  clicks INT64,
  ctr FLOAT64,
  position FLOAT64,
  
  -- Hash pour détecter changements
  snapshot_hash STRING, -- MD5(title + description + intent)
  
  -- Métadonnées
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY snapshot_date
CLUSTER BY domain, url
OPTIONS(
  description="Snapshots SERP pour tracking évolution optimisations",
  partition_expiration_days=365
);
```

#### 3.2 Fonction de snapshot
```typescript
async function saveSerpSnapshot(preview: SerpPreview, gscMetrics: { ctr: number, position: number, impressions: number, clicks: number }) {
  const hash = createHash(preview.title + preview.description + preview.intent)
  const snapshot = {
    snapshot_date: new Date().toISOString().split('T')[0],
    url: preview.url,
    domain: extractDomain(preview.url),
    intent_declared: preview.intent,
    intent_inferred: preview.intentInferred,
    intent_match_score: preview.intentMatchScore,
    title: preview.title,
    description: preview.description,
    title_length: preview.title?.length || 0,
    desc_length: preview.description?.length || 0,
    has_faq: preview.hasFAQ,
    has_rating: preview.hasAggregateRating,
    has_breadcrumb: preview.hasBreadcrumb,
    has_howto: preview.hasHowTo,
    has_article: preview.hasArticle,
    has_video: preview.hasVideo,
    has_localbusiness: preview.hasLocalBusiness,
    score_rich_results: preview.scoreRichResults,
    score_length: preview.scoreLength,
    impressions: gscMetrics.impressions,
    clicks: gscMetrics.clicks,
    ctr: gscMetrics.ctr,
    position: gscMetrics.position,
    snapshot_hash: hash
  }
  
  // INSERT dans BigQuery
}
```

#### 3.3 Détection changements
```typescript
async function detectChanges(url: string, currentHash: string): Promise<ChangeDetection> {
  // Requête dernier snapshot
  const lastSnapshot = await getLastSnapshot(url)
  
  if (!lastSnapshot) return { hasChanges: false }
  
  if (lastSnapshot.snapshot_hash !== currentHash) {
    return {
      hasChanges: true,
      changes: {
        title: lastSnapshot.title !== current.title,
        description: lastSnapshot.description !== current.description,
        intent: lastSnapshot.intent_declared !== current.intent,
      },
      previousCTR: lastSnapshot.ctr,
      currentCTR: current.ctr,
      ctrDelta: current.ctr - lastSnapshot.ctr
    }
  }
  
  return { hasChanges: false }
}
```

---

## 🎨 UI : Affichage dans l'aperçu SERP

### Layout proposé
```
┌─────────────────────────────────────────┐
│ ✓ Fiable                                │
│                                         │
│ Titre de la page                        │
│ domain.com > path                       │
│ Description...                          │
│                                         │
│ 🎯 Intent: transactional                │
│ ⚠️ Intent mismatch (0%)                 │ ← Phase 1
│    Déclaré: informational               │
│    Réel: transactional                  │
│                                         │
│ 📏 Length: NOK (title 62 chars)        │ ← Phase 1
│                                         │
│ ✨ Rich: FAQ, Rating, HowTo             │ ← Phase 1
│                                         │
│ 📊 CTR: 2.3% (vs 3.5% benchmark) ⚠️    │ ← Phase 2
│                                         │
│ 📈 Évolution: +0.5% vs dernier scan     │ ← Phase 3
└─────────────────────────────────────────┘
```

### Filtres/Tri
- Tri par : Intent mismatch (priorité), CTR vs benchmark, Score global
- Filtres : Intent, Score < 50, CTR < benchmark

### Export CSV
```csv
URL,Intent déclaré,Intent réel,Match Score,Length Score,Rich Score,CTR,Benchmark,Delta CTR
https://...,transactional,transactional,100,100,85,0.035,0.035,0.000
```

---

## 🚀 Ordre d'implémentation recommandé

### Step 1 : Phase 1 (2h)
1. ✅ Ajouter calcul intent réel
2. ✅ Ajouter Intent Match Score
3. ✅ Ajouter détection Rich Results supplémentaires
4. ✅ Ajouter Length Score binaire
5. ✅ Mettre à jour types TypeScript
6. ✅ Afficher dans UI (badges)

### Step 2 : Phase 2 (1h)
1. ✅ Créer fonction calcul benchmarks (top 10 par intent)
2. ✅ Ajouter CTR vs benchmark dans l'affichage
3. ⚠️ **Blocage** : Nécessite que `intent` soit dans BigQuery (Phase 3)

### Step 3 : Phase 3 (3h)
1. ✅ Créer migration BigQuery `serp_snapshots`
2. ✅ Implémenter sauvegarde snapshot (manuel ou auto)
3. ✅ Implémenter détection changements
4. ✅ Créer fonction benchmarks depuis BigQuery (réutilise Step 2)

### Step 4 : Filtres + Export (30min)
1. ✅ Ajouter filtres UI
2. ✅ Ajouter export CSV

---

## ⚠️ Blocage identifié

**Phase 2 dépend de Phase 3** : Pour calculer les benchmarks CTR par intent, il faut que l'intent soit stocké dans BigQuery.

**Solution** : Implémenter Phase 1 + Phase 3 en premier, puis Phase 2.

---

## 📋 Checklist finale

### Phase 1
- [ ] Fonction `inferIntentFromContent()`
- [ ] Fonction `calculateIntentMatchScore()`
- [ ] Détection Rich Results (HowTo, Article, Video, LocalBusiness)
- [ ] Fonction `calculateLengthScore()` (binaire conservateur)
- [ ] Mise à jour types TypeScript
- [ ] Affichage badges dans UI

### Phase 2
- [ ] Migration BigQuery `serp_snapshots`
- [ ] Fonction `saveSerpSnapshot()`
- [ ] Fonction `getCTRBenchmarksByIntent()` (requête BigQuery)
- [ ] Fonction `calculateCTRScore()`
- [ ] Affichage CTR vs benchmark dans UI

### Phase 3
- [ ] Fonction `detectChanges()`
- [ ] Affichage évolution dans UI
- [ ] Dashboard évolution (optionnel)

### Bonus
- [ ] Filtres/tri UI
- [ ] Export CSV
- [ ] Page dédiée "Optimisations SERP"

---

**Prochaine étape** : Valider ce plan, puis commencer Phase 1 ?

