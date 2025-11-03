# 🔧 Guide Résolution Erreurs Build TypeScript/Next.js sur CapRover

## ⚠️ Erreurs Courantes

### Erreur : "Route does not match required types - invalid export field"

**Message d'erreur :**
```
Type error: Route "app/api/xxx/route.ts" does not match the required types of a Next.js Route.
  "functionName" is not a valid Route export field.
```

**Cause :** Next.js 13+ App Router ne permet que certains exports dans les routes API :
- ✅ `export async function GET/POST/PUT/DELETE/PATCH`
- ✅ `export const dynamic = 'force-dynamic'`
- ✅ `export const revalidate = 3600`
- ✅ `export const runtime = 'nodejs'`
- ❌ **TOUTES les autres exports sont interdites** (functions, constants, classes, etc.)

**Solution :**

1. **Déplacer les fonctions utilitaires dans `lib/`**
   ```bash
   # Avant (INCORRECT)
   # app/api/serp/preview/route.ts
   export function helperFunction() { ... }
   export async function GET() { ... }
   
   # Après (CORRECT)
   # lib/serp-utils.ts
   export function helperFunction() { ... }
   
   # app/api/serp/preview/route.ts
   import { helperFunction } from '@/lib/serp-utils'
   export async function GET() { ... }
   ```

2. **Vérifier avant commit**
   ```bash
   # Script de vérification
   cd dashboard
   grep -r "^export \(function\|const\|class\|async function\)" app/api/*/route.ts | grep -v "export async function \(GET\|POST\|PUT\|DELETE\|PATCH\)" | grep -v "export const dynamic\|export const revalidate\|export const runtime"
   ```

---

### Erreur : "Property does not exist on type ProcessEnv"

**Message d'erreur :**
```
Type error: Property 'GCP_SA_KEY_JSON' does not exist on type ProcessEnv.
```

**Cause :** TypeScript a un typage strict des variables d'environnement.

**Solution :**

```typescript
// ❌ INCORRECT
const envVars = {
  NODE_ENV: process.env.NODE_ENV,
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
}
if (process.env.GCP_SA_KEY_JSON) {
  envVars.GCP_SA_KEY_JSON = process.env.GCP_SA_KEY_JSON // ❌ Erreur type
}

// ✅ CORRECT
const envVars: Record<string, string | undefined> = {
  NODE_ENV: process.env.NODE_ENV,
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
}
if (process.env.GCP_SA_KEY_JSON) {
  envVars.GCP_SA_KEY_JSON = process.env.GCP_SA_KEY_JSON
}

// Pour execAsync
const { stdout } = await execAsync('command', {
  env: envVars as NodeJS.ProcessEnv, // Cast nécessaire
})
```

---

## 🛠️ Checklist Avant Push vers CapRover

### 1. Vérifier les exports dans les routes API

```bash
cd dashboard

# Trouver tous les exports invalides
find app/api -name "route.ts" -exec grep -l "^export \(function\|const\|class\)" {} \; | \
  while read file; do
    echo "🔍 Checking $file"
    grep "^export" "$file" | grep -v "export async function \(GET\|POST\|PUT\|DELETE\|PATCH\)" | \
      grep -v "export const \(dynamic\|revalidate\|runtime\)"
  done

# Si aucune sortie = ✅ OK
# Si sortie = ❌ Déplacer les exports dans lib/
```

### 2. Vérifier les types TypeScript

```bash
cd dashboard
npm run build 2>&1 | grep -E "(error TS|Failed to compile)"
```

**Doit retourner :** Aucune erreur.

### 3. Vérifier les imports

```bash
# Vérifier qu'aucun route.ts n'importe depuis un autre route.ts
cd dashboard
find app/api -name "route.ts" -exec grep -l "from.*route" {} \;
```

**Doit retourner :** Liste vide (ou seulement des imports autorisés).

---

## 🔄 Processus de Correction

### Étape 1 : Identifier l'erreur

```bash
# Dans CapRover logs, chercher :
grep -E "(Type error|Failed to compile|invalid Route export)" logs.txt
```

### Étape 2 : Corriger localement

```bash
# 1. Tester le build local
cd dashboard
npm run build

# 2. Si erreur, corriger
# 3. Re-tester
npm run build

# 4. Vérifier les lints
npm run lint
```

### Étape 3 : Commit et Push

```bash
git add -A
git commit -m "fix: [description]"
git push origin main
```

### Étape 4 : Vérifier CapRover

1. Attendre le rebuild (~3-5min)
2. Vérifier les logs CapRover
3. Si erreur persiste :
   - Vérifier que le code est bien poussé (`git log`)
   - Vérifier le cache Docker (forcer rebuild complet)

---

## 🚨 Cache Docker - Forcer Rebuild Complet

Si l'erreur persiste après correction, le cache Docker peut être en cause :

### Option 1 : Via CapRover UI

1. Apps → `dd-dashboard` → Deployment
2. Cliquer **"Force Rebuild"** (ou "Clear Build Cache" si disponible)

### Option 2 : Via CLI CapRover

```bash
caprover rebuild -a dd-dashboard --force
```

### Option 3 : Vider le cache Docker manuellement (sur le serveur CapRover)

```bash
# SSH dans le serveur CapRover
docker system prune -a --volumes
# Puis rebuilder via CapRover UI
```

---

## 📋 Structure Recommandée pour Routes API

```
app/api/
├── serp/
│   ├── preview/
│   │   └── route.ts          # ✅ Seulement GET/POST + exports Next.js
│   ├── audit/
│   │   └── route.ts          # ✅ Seulement GET/POST + exports Next.js
│   └── ...
lib/
├── serp-utils.ts             # ✅ Toutes les fonctions utilitaires
├── bigquery.ts               # ✅ Client BigQuery + helpers
└── utils.ts                   # ✅ Fonctions générales
```

**Règle d'or :** Si une fonction peut être utilisée par plusieurs routes ou est testable isolément → `lib/`

---

## 🎯 Exemples de Corrections

### Exemple 1 : Export de fonction dans route.ts

**Avant (❌) :**
```typescript
// app/api/serp/preview/route.ts
export function inferIntentFromContent(...) { ... }
export async function GET() { ... }
```

**Après (✅) :**
```typescript
// lib/serp-utils.ts
export function inferIntentFromContent(...) { ... }

// app/api/serp/preview/route.ts
import { inferIntentFromContent } from '@/lib/serp-utils'
export async function GET() { ... }
```

### Exemple 2 : Export de constante

**Avant (❌) :**
```typescript
// app/api/config/route.ts
export const MAX_LIMIT = 100
export async function GET() { ... }
```

**Après (✅) :**
```typescript
// lib/config.ts
export const MAX_LIMIT = 100

// app/api/config/route.ts
import { MAX_LIMIT } from '@/lib/config'
export async function GET() { ... }
```

---

## 📚 Références

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)

---

## ✅ Checklist Finale

Avant de pousser vers CapRover :

- [ ] `npm run build` passe sans erreur
- [ ] `npm run lint` passe sans erreur
- [ ] Aucun export invalide dans `app/api/*/route.ts`
- [ ] Toutes les fonctions utilitaires sont dans `lib/`
- [ ] Types TypeScript corrects (pas d'erreur `Property does not exist`)
- [ ] Tests locaux passent (si applicables)

**Si tout est ✅ :** Prêt pour push → CapRover → Build devrait réussir 🚀

