# 🔍 AUDIT COMPLET DU DASHBOARD MOVERZ

**Date :** 2025-01-25  
**Responsable :** Audit Technique et Maintenabilité  
**Scope :** Dashboard Next.js Analytics

---

## 📊 RÉSUMÉ EXÉCUTIF

### Évaluation Globale : **B+ (7.5/10)**

Le dashboard Moverz est un projet **solide et fonctionnel** avec une architecture moderne (Next.js 14), mais présente des **problèmes de maintenabilité** et **dettes techniques** qui nécessitent une attention urgente.

### Points Forts ⭐
- ✅ Architecture Next.js 14 moderne (App Router)
- ✅ TypeScript strict mode
- ✅ UI/UX cohérente avec Tailwind
- ✅ Fonctionnalités avancées (404 crawler, insights IA, chat)
- ✅ Intégration BigQuery fonctionnelle
- ✅ Pas d'erreurs de lint

### Points Critiques 🚨
- ❌ **Mélange de stockage** : BigQuery + JSON (543 lignes json-storage.ts)
- ❌ **Duplication de données** : Historique dans 2 systèmes
- ❌ **Pas de .env.example** : Configuration opaque
- ❌ **Hardcodage massif** : URLs, domaines, mappings partout
- ❌ **Gestion d'erreurs inconsistante** : 58 console.log/warn/error dans API
- ❌ **Pas de monitoring** : Logs insuffisants
- ❌ **Tests absents** : AUCUNE couverture

---

## 1. ARCHITECTURE & STRUCTURE

### 1.1 Structure des Dossiers ✅
```
dashboard/
├── app/                    # App Router Next.js ✅
│   ├── api/               # API Routes ✅
│   ├── page.tsx           # Home ✅
│   ├── 404/               # Feature complète ✅
│   └── sites/             # Par domaine ✅
├── components/            # Composants réutilisables ✅
├── lib/                   # Utilitaires ✅
└── data/                  # ⚠️ Fichiers JSON (problématique)
```

**Note :** Structure propre et cohérente avec Next.js 14

---

## 2. STOCKAGE DES DONNÉES 🚨 CRITIQUE

### 2.1 Double Système de Stockage

#### BigQuery (Production)
- Tables : `gsc_daily_aggregated`, `gsc_daily_metrics`, `errors_404_history`, etc.
- Utilisé pour : Métriques GSC, Insights IA, Historique 404

#### Fichiers JSON Locaux
```bash
dashboard/data/
├── errors-404-history.json      # Historique des scans
├── errors-404-urls.json          # URLs 404 par scan
├── broken-links.json             # Liens cassés persistants
└── broken-links-scans.json       # Liens cassés par scan
```

**Problème Majeur :**  
Le système utilise **2 sources de vérité** pour l'historique 404 :
1. BigQuery (`errors_404_history`) - utilisé par `/api/404/history`
2. JSON local (`data/errors-404-history.json`) - créé par `json-storage.ts`

**Exemple de conflit :**
```typescript
// lib/json-storage.ts:150 - Sauvegarde JSON
export async function insertError404History(entry) {
  const data = readData()  // Lit le JSON
  data.push(entry)
  writeData(data)  // Écrit le JSON
}

// lib/bigquery.ts:214 - Sauvegarde BigQuery (COMENTE DANS CODE?)
// export async function insertError404History(entry) {
//   const query = `INSERT INTO \`${projectId}.${dataset}.errors_404_history\` ...
```

**Impact :**
- ❌ Risque de désynchronisation
- ❌ Confusion pour les développeurs
- ❌ Maintenance doublée
- ❌ Pas de garantie transactionnelle

### 2.2 Recommandations Urgentes

**Option A : Migration vers BigQuery uniquement** (Recommandé)
- Supprimer `json-storage.ts` (543 lignes)
- Utiliser uniquement BigQuery pour l'historique
- Ajouter un cache Redis si nécessaire

**Option B : Migration vers PostgreSQL**
- Via Prisma (mentionné dans rules)
- Centré BDD unique

**Option C : Garder JSON mais documenter**
- Choisir une source de vérité unique
- Ajouter synchronisation explicite
- Documenter l'architecture

---

## 3. CONFIGURATION & VARIABLES D'ENVIRONNEMENT 🚨

### 3.1 Absence de .env.example

```bash
❌ dashboard/.env.example  # N'EXISTE PAS
```

**Problèmes :**
- Configuration opaque pour nouveaux devs
- Variables non documentées
- Risque de variables manquantes en prod

**Variables identifiées dans le code :**
```bash
# BigQuery
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
BQ_LOCATION=europe-west1
GCP_SA_KEY_JSON={...}
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

# OpenAI
OPENAI_API_KEY=sk-...

# GitHub
GITHUB_TOKEN=ghp_...

# Sites
SITES_LIST=devis-demenageur-marseille.fr,devis-demenageur-toulousain.fr,...

# Next.js
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_SITE_NAME=Moverz Analytics
```

### 3.2 Recommandation Urgente
Créer `dashboard/.env.example` avec toutes les variables documentées

---

## 4. HARDCODAGE MASSIF 🚨

### 4.1 Liste des Sites en Dur

**13 occurrences identifiées** dans le code :

1. `app/api/404/crawl/route.ts:12-24` - Crawler 404
2. `app/sites/[domain]/page.tsx:9-21` - Liste sites
3. `lib/utils.ts:26-38` - Mapping villes/domaines
4. `app/api/vitals/route.ts:6-18` - Mapping domain/city
5. `app/api/vitals/route.ts:45-57` - Mapping domain/repo GitHub
6. `app/page.tsx:100-106` - Sites avec linking
7. Etc.

**Impact :**
- ❌ Ajout de nouveau site = modification de 13 fichiers
- ❌ Risque d'incohérence
- ❌ Pas de gestion centralisée

**Recommandation :**
Créer `lib/sites.ts` :
```typescript
export const SITES = [
  { domain: 'devis-demenageur-marseille.fr', city: 'marseille', ... },
  ...
] as const
```

### 4.2 URLs et Endpoints Hardcodés

**Exemples trouvés :**
```typescript
// app/api/vitals/route.ts:122
const url = `https://api.github.com/repos/${repo}/commits`

// app/api/chat/route.ts:63
const strategyPath = path.join(process.cwd(), 'dashboard/data/strategy.md')

// app/api/404/crawl/route.ts:147
headers: { 'User-Agent': 'Moverz-Analytics-Bot/1.0' }
```

---

## 5. GESTION D'ERREURS ⚠️

### 5.1 Logs Inconsistants

**58 occurrences de console.log/warn/error** dans les API routes :
- `app/api/chat/route.ts`: 14 logs
- `app/api/404/crawl/route.ts`: 17 logs
- `app/api/serp/preview/route.ts`: 1 log
- Etc.

**Problèmes :**
- Pas de structuration (JSON)
- Pas de niveaux standardisés
- Logs de prod = logs de dev

**Exemple :**
```typescript
// Mauvais
console.log('✅ Crawl completed')
console.error('❌ Crawl error:', error)

// Meilleur (avec lib logger)
logger.info('crawl.completed', { duration, sites })
logger.error('crawl.failed', { error: error.message, stack })
```

### 5.2 Gestion d'Erreurs API Routes

**Pattern incohérent :**

```typescript
// app/api/metrics/global/route.ts ✅ Bon
try {
  const data = await getGlobalMetrics(days)
  return NextResponse.json({ success: true, data })
} catch (error: any) {
  console.error('API /metrics/global error:', error)
  return NextResponse.json({ success: false, error: error.message }, { status: 500 })
}

// app/api/404/history/route.ts ⚠️ Fallback silencieux
catch (error: any) {
  console.error('API /404/history error:', error)
  return NextResponse.json({ success: true, data: { evolution: [] } })  // ❌ Caché l'erreur
}
```

**Recommandation :**
Créer un middleware d'erreur global ou wrapper pour API routes

---

## 6. SÉCURITÉ 🔒

### 6.1 Points Positifs ✅
- Next.js headers de sécurité configurés
- Credentials GCP dans env (pas hardcodés)
- Validation basique des inputs

### 6.2 Points d'Attention ⚠️

#### Injection SQL (Partiel)
```typescript
// app/api/vitals/route.ts:22-24
const domains = sitesListEnv.split(',').map(s => s.trim()).filter(Boolean)
// ⚠️ Pas de validation du format de domaine

// app/api/insights/route.ts:17
const whereClause = `WHERE ... AND agent = '${agent}'`  // ⚠️ Pas de param
// Meilleur:
const whereClause = `WHERE ... AND agent = @agent`
const params = { agent }
```

#### Credentials Exposition
```typescript
// app/api/analyze/route.ts:103
if (!process.env.OPENAI_API_KEY) {
  return NextResponse.json({ error: 'OpenAI API key not configured' })
}
// ✅ Bon : vérification de présence
```

#### Rate Limiting
❌ **Aucun rate limiting** sur les API routes publiques
- `/api/404/crawl` : Appelable en boucle
- `/api/etl/run` : Déclenchement manuel non protégé

**Recommandation :**
- Ajouter middleware rate limiting (Next.js middleware)
- Limiter à 10 req/min pour `/api/404/crawl`
- Protéger `/api/etl/run` avec authentification

---

## 7. PERFORMANCE 📈

### 7.1 Points Positifs ✅
- `useCallback` pour éviter re-renders inutiles
- `Promise.all` pour parallélisation (crawler 404)
- Next.js optimisations activées

### 7.2 Points d'Attention ⚠️

#### N+1 Queries Potentiel
```typescript
// app/api/vitals/route.ts:174
const vitalsPromises = sites.map(async (site) => {
  const [health, lastCommit] = await Promise.all([
    checkHealth(url),           // 1 requête par site
    getLastCommit(repo),        // 1 requête par site
  ])
})
// ✅ Bon : Parallélisé, mais pas de cache

// Problème : Si 11 sites, 22 requêtes HTTP systématiquement
```

#### Pas de Cache
```typescript
// app/api/metrics/global/route.ts
export const dynamic = 'force-dynamic'  // ❌ Pas de cache
```

**Recommandation :**
- Ajouter cache Redis ou Next.js cache
- Cache de 5min pour métriques

---

## 8. TESTS ❌ CRITIQUE

### État Actuel
```
❌ Aucun test unitaire
❌ Aucun test d'intégration
❌ Aucun test E2E
❌ Coverage : 0%
```

**Impact :**
- Risque élevé de régression
- Refactoring dangereux
- Debugging difficile

**Recommandations Urgentes :**
1. **Tests critiques prioritaires** :
   - `crawlSite()` (app/api/404/crawl/route.ts)
   - `normalizeUrl()` (app/api/404/crawl/route.ts)
   - BigQuery queries (lib/bigquery.ts)

2. **Setup initial** :
```bash
npm install -D jest @testing-library/react @testing-library/jest-dom
```

3. **CI/CD** :
   - Bloquer merges si tests échouent
   - Couverture minimale : 60%

---

## 9. DOCUMENTATION 📚

### Points Positifs ✅
- README.md complet
- Documentation features (FEATURE-404-HISTORY.md, etc.)
- Commentaires dans code (modérés)

### Points d'Amélioration ⚠️
- ❌ Pas de JSDoc sur fonctions complexes
- ❌ Pas de diagramme d'architecture
- ❌ Pas de guide de contribution

---

## 10. MAINTENABILITÉ 🛠️

### Métriques Code

| Fichier | Lignes | Complexité | Problèmes |
|---------|--------|------------|-----------|
| `app/404/page.tsx` | **730** | 🔴 Élevée | Trop de responsabilités |
| `lib/json-storage.ts` | **543** | 🟡 Moyenne | Double stockage |
| `app/api/404/crawl/route.ts` | 466 | 🟡 Moyenne | Hardcodage |
| `app/api/vitals/route.ts` | 214 | 🟢 Basse | OK |
| `components/Navigation.tsx` | 146 | 🟢 Basse | OK |

### Problèmes de Complexité

#### app/404/page.tsx (730 lignes)
**Responsabilités multiples :**
1. Gestion état (scanning, results, history, delta)
2. Logique SSE streaming
3. Rendu UI complexe
4. Format CSV export
5. Formatage dates

**Recommandation :**
Diviser en sous-composants :
- `404Scanner.tsx` - État scan + SSE
- `404ResultsTable.tsx` - Tableau résultats
- `404HistoryChart.tsx` - Graphique évolution
- `404DeltaBanner.tsx` - Bandeau delta

---

## 11. PRIORISATION DES PROBLÈMES

### 🔴 CRITIQUE (À faire maintenant)
1. **Double stockage** (json-storage vs BigQuery)
   - **Impact** : Désynchronisation données
   - **Effort** : 3 jours
   - **Action** : Choisir source unique

2. **Absence de tests**
   - **Impact** : Régression production
   - **Effort** : 1 semaine
   - **Action** : Setup Jest + 10 tests critiques

3. **Pas de .env.example**
   - **Impact** : Onboarding bloqué
   - **Effort** : 1 heure
   - **Action** : Créer fichier + doc

### 🟡 IMPORTANT (À faire sous 1 mois)
4. **Hardcodage sites**
   - **Impact** : Maintenance coûteuse
   - **Effort** : 2 jours
   - **Action** : Centraliser dans `lib/sites.ts`

5. **Rate limiting**
   - **Impact** : Abus possible
   - **Effort** : 1 jour
   - **Action** : Middleware Next.js

6. **Logs incohérents**
   - **Impact** : Debugging difficile
   - **Effort** : 2 jours
   - **Action** : Lib logger structuré

### 🟢 SOUHAITABLE (À faire sous 3 mois)
7. **Refactor page 404** (730 lignes)
8. **Cache Redis** pour performance
9. **Monitoring** (Sentry, DataDog)
10. **Documentation** JSDoc

---

## 12. PLAN D'ACTION RECOMMANDÉ

### Sprint 1 (Semaine 1-2) : Stabilisation
- [ ] Créer `.env.example` + documentation
- [ ] Tester double stockage, choisir source unique
- [ ] Setup Jest + 5 tests critiques

### Sprint 2 (Semaine 3-4) : Sécurité & Performance
- [ ] Ajouter rate limiting
- [ ] Centraliser sites dans `lib/sites.ts`
- [ ] Ajouter cache Next.js (5min)

### Sprint 3 (Semaine 5-8) : Tests & Qualité
- [ ] Coverage 60%
- [ ] Setup logger structuré
- [ ] Refactor page 404

### Sprint 4 (Semaine 9-12) : Améliorations
- [ ] Monitoring production
- [ ] Documentation JSDoc
- [ ] Performance audit

---

## 13. MÉTRIQUES DE SUCCÈS

### Objectifs à 3 mois
- ✅ Coverage tests : 60%
- ✅ Temps de build : < 2min
- ✅ Temps de chargement : < 2s
- ✅ 0 erreur lint
- ✅ Documentation complète

---

## 14. CONCLUSION

Le dashboard Moverz est **architecturalement sain** mais souffre de **dettes techniques accumulées**. Les 3 priorités absolues sont :

1. **Résoudre le double stockage** (stabilité données)
2. **Ajouter des tests** (sécurité changements)
3. **Documenter la config** (onboarding)

Avec ces 3 actions, le projet sera **production-ready** et maintenable.

---

**Audit réalisé par :** GPT-4  
**Sign-off recommandé par :** Lead Dev + Product Owner  
**Prochaine revue :** 3 mois

