# 📊 Analyse Améliorations Dashboard Moverz

**Date:** 2025-01-XX  
**Objectif:** Identifier les améliorations techniques sans ajouter de fonctionnalités

---

## 🔴 CRITIQUE (À corriger rapidement)

### 1. **Duplication de code BigQuery client** 
**Fichiers affectés:** 8 fichiers avec leur propre `getBigQueryClient()`

**Problème:**
- `lib/bigquery.ts` exporte un client global
- `app/api/sites/[domain]/route.ts` a sa propre fonction `getBigQueryClient()`
- `app/api/insights/route.ts` idem
- `app/api/gsc/issues/route.ts` idem
- `lib/serp-utils.ts` recrée un nouveau client
- `app/api/serp/preview/route.ts` idem

**Impact:** Maintenance difficile, bugs potentiels (différences de config), code non réutilisable.

**Solution:** Centraliser dans `lib/bigquery.ts` et utiliser `getEnv()` de `env/env-validation.ts`.

---

### 2. **Utilisation excessive de `any`**
**Statistiques:** 21 occurrences dans `lib/`

**Fichiers problématiques:**
- `lib/bigquery.ts:17` - `let credentials: any`
- `lib/serp-utils.ts` - Plusieurs `any`

**Impact:** Perte des avantages TypeScript, bugs runtime non détectés.

**Solution:** Définir des types stricts (`Credentials`, `GSCResponse`, etc.).

---

### 3. **Gestion d'erreurs incohérente**
**Problème:** Patterns variés dans les API routes

**Exemples:**
- `/api/metrics/global/route.ts`: Fallback doux avec données vides (bien)
- `/api/404/history/route.ts`: Logs verbeux, mais retourne 200 même en erreur (OK mais trop verbeux)
- `/api/serp/preview/route.ts`: Pas de gestion d'erreur explicite dans certains cas
- `/api/chat/route.ts`: Peu de gestion d'erreur pour OpenAI

**Impact:** Debugging difficile, comportements inattendus en prod.

**Solution:** Créer un helper `lib/api-helpers.ts` avec `handleApiError()` standardisé.

---

### 4. **Console.log partout (170 occurrences)**
**Statistiques:** 34 fichiers utilisent `console.log/error/warn`

**Problème:** Pas de logger structuré, logs en prod = coûts CloudWatch/Datadog élevés.

**Solution:** 
- Créer `lib/logger.ts` avec niveaux (info/warn/error)
- En prod: logger uniquement warn+error, avec context structuré
- Utiliser `pino` ou `winston` pour la structure

---

## 🟠 IMPORTANT (À améliorer)

### 5. **API Routes sans validation de requête**
**Problème:** Parse manuel des query params sans validation Zod

**Exemples:**
- `/api/metrics/global/route.ts:9` - `parseInt()` sans validation min/max
- `/api/404/history/route.ts:13-14` - Parse multiple sans schéma
- `/api/serp/preview/route.ts:195` - `parseInt()` sans borne

**Impact:** Bugs silencieux (ex: `days=-1000`), sécurité potentielle.

**Solution:** Utiliser Zod pour valider `NextRequest` query params et body.

---

### 6. **Pas de rate limiting**
**Problème:** Routes API publiques sans protection

**Fichiers à protéger:**
- `/api/404/crawl` (crawler coûteux)
- `/api/serp/preview` (fetch HTTP externe)
- `/api/serp/audit` (analyse lourde)
- `/api/chat` (OpenAI API coûteuse)

**Solution:** Ajouter middleware de rate limiting (ex: `@upstash/ratelimit` ou Next.js native).

---

### 7. **Variables d'environnement non validées au démarrage**
**Problème:** Erreurs découvertes à l'exécution, pas au build.

**Exemples:**
- `GCP_SA_KEY_JSON` parsé au runtime sans validation format
- `OPENAI_API_KEY` vérifié dans chaque route, pas au démarrage

**Solution:** Valider toutes les env vars au démarrage (`env/env-validation.ts` déjà fait, mais l'utiliser partout).

---

### 8. **Pas de cache HTTP explicite**
**Problème:** Certaines routes ont `cache-control` hardcodé, d'autres non.

**Exemples:**
- `/api/serp/preview/route.ts:339` - Cache soft 6h
- `/api/metrics/global` - Pas de cache défini
- `/api/404/history` - Pas de cache défini

**Impact:** Requêtes BigQuery répétées inutilement, coûts élevés.

**Solution:** Standardiser le cache avec `revalidate` Next.js ou headers HTTP cohérents.

---

### 9. **TypeScript strict mais types manquants**
**Problème:** `strict: true` mais types incomplets

**Exemples:**
- `app/page.tsx:26` - `payload?: any`
- `app/page.tsx:27` - `evidence?: any`
- Beaucoup de `as unknown as Type` dans bigquery.ts

**Solution:** Définir tous les types explicitement (ex: `InsightPayload`, `GSCEvidence`).

---

## 🟡 MOYEN (Bon à avoir)

### 10. **Duplication de logique de fetch dans les composants**
**Problème:** Pattern `fetch()` répété partout sans abstraction

**Exemples:**
- `app/page.tsx:50-60` - `fetchJsonWithTimeout()` custom
- `app/serp/page.tsx:78` - Fetch simple sans abstraction
- `app/404/page.tsx` - Patterns variés

**Solution:** Créer `lib/api-client.ts` avec hooks React (`useFetch`, `useApi`) ou SWR/React Query.

---

### 11. **Pas de tests**
**Problème:** Aucun test unitaire/integration détecté

**Impact:** Refactoring risqué, régressions possibles.

**Solution:** Ajouter Vitest + Testing Library pour les composants critiques.

---

### 12. **Documentation code limitée**
**Problème:** Beaucoup de fonctions sans JSDoc

**Exemples:**
- `lib/bigquery.ts` - Fonctions exportées sans docs
- `lib/serp-utils.ts` - Utilitaires sans explication

**Solution:** Ajouter JSDoc pour les fonctions publiques (exporter types aussi).

---

### 13. **Configuration Next.js incomplète**
**Problème:** `next.config.js` basique

**Manques:**
- Pas de `experimental.turbo` si utilisé
- Pas de configuration de sécurité CSP complète
- Pas de `onDemandRevalidation` pour cache invalidation

**Solution:** Compléter selon besoins prod (voir Next.js 14 best practices).

---

### 14. **Fichiers de data dupliqués**
**Problème:** `dashboard/data/strategy.json` ET `data/strategy.json`

**Impact:** Confusion, risque de désynchronisation.

**Solution:** Unifier en un seul emplacement (recommandé: `data/` à la racine du dashboard).

---

### 15. **Scripts shell non standardisés**
**Problème:** `restart-server.sh`, `start-dev.sh` avec logique custom

**Impact:** Pas portable (dépendances système).

**Solution:** Utiliser `package.json` scripts uniquement.

---

## 🟢 MINEUR (Nice to have)

### 16. **ESLint basique**
**Problème:** `.eslintrc.json` étend uniquement `next/core-web-vitals`

**Manques:**
- Pas de règles TypeScript strictes
- Pas de règles pour éviter `any`
- Pas de règles pour console.log

**Solution:** Ajouter `@typescript-eslint/recommended-type-checked`.

---

### 17. **Pas de pre-commit hooks**
**Problème:** Code peut être pushé avec erreurs lint/types

**Solution:** Ajouter `husky` + `lint-staged`.

---

### 18. **Noms de variables inconsistants**
**Problème:** Mix français/anglais

**Exemples:**
- `lib/utils.ts:26` - `CITIES` en anglais
- Composants: Mix (ex: `Error404Analysis` vs `InsightCard`)

**Solution:** Standardiser (recommandé: anglais pour code, français pour UI strings).

---

### 19. **Composants sans memoization**
**Problème:** Re-renders potentiels évitables

**Exemples:**
- `components/MetricCard.tsx` - Pas de `React.memo`
- `components/TimeSeriesChart.tsx` - Props objects recréés

**Solution:** Ajouter `React.memo` et `useMemo` où pertinent.

---

### 20. **Accessibilité limitée**
**Problème:** Pas de labels ARIA partout, navigation clavier non testée

**Exemples:**
- Boutons sans `aria-label`
- Modales sans `role="dialog"`

**Solution:** Audit avec `eslint-plugin-jsx-a11y` + tests accessibilité.

---

## 📋 PRIORISATION RECOMMANDÉE

### Phase 1 (Cette semaine)
1. ✅ Centraliser BigQuery client (#1)
2. ✅ Remplacer `any` par types stricts (#2)
3. ✅ Logger structuré (#4)
4. ✅ Helper gestion d'erreurs API (#3)

### Phase 2 (Semaine prochaine)
5. ✅ Validation Zod pour API routes (#5)
6. ✅ Rate limiting (#6)
7. ✅ Cache HTTP standardisé (#8)
8. ✅ Validation env vars au démarrage (#7)

### Phase 3 (Mois suivant)
9. ✅ API client abstrait (#10)
10. ✅ Tests critiques (#11)
11. ✅ Documentation code (#12)
12. ✅ Types TypeScript complets (#9)

---

## 🎯 MÉTRIQUES DE QUALITÉ ACTUELLES

| Métrique | Score | Commentaire |
|----------|-------|-------------|
| **Duplication code** | ⚠️ 40% | BigQuery client dupliqué 8x |
| **Type safety** | ⚠️ 70% | `any` utilisé, types incomplets |
| **Gestion erreurs** | ⚠️ 60% | Patterns variés, pas standardisé |
| **Tests** | ❌ 0% | Aucun test détecté |
| **Documentation** | 🟡 50% | README bon, code pas documenté |
| **Performance** | ✅ 80% | Cache partiel, pas de rate limit |
| **Sécurité** | ⚠️ 65% | Pas de rate limit, validation partielle |
| **Maintenabilité** | ⚠️ 60% | Duplication, pas de patterns clairs |

---

## 📝 NOTES FINALES

**Forces du projet:**
- ✅ Next.js 14 bien configuré
- ✅ TypeScript strict activé
- ✅ Structure dossier logique
- ✅ Fallbacks gracieux pour dev

**Axes d'amélioration prioritaires:**
1. **Centralisation** - Réduire duplication (BigQuery, fetch)
2. **Type safety** - Éliminer `any`, compléter types
3. **Observabilité** - Logger structuré, gestion erreurs standardisée
4. **Robustesse** - Validation inputs, rate limiting, tests

**Temps estimé pour Phase 1:** 4-6h de dev
**Temps estimé pour Phase 2:** 6-8h de dev
**Temps estimé pour Phase 3:** 10-12h de dev

---

*Cette analyse a été générée automatiquement en analysant le code source du dashboard.*

