# ⚡ Quick Start - Dashboard Moverz

**Guide rapide pour comprendre et modifier le dashboard.**

---

## 🎯 Pour Cursor (IA) - Lecture Rapide

### Structure en 30 Secondes

```
📁 dashboard/
├── app/
│   ├── page.tsx           # Home (KPIs globaux)
│   ├── api/               # Backend Next.js (BigQuery, IA, etc.)
│   └── [routes]/page.tsx  # Autres pages
├── components/            # Composants React réutilisables
├── lib/
│   ├── bigquery.ts        # ⭐ CŒUR: Toutes les queries BigQuery
│   ├── api-helpers.ts     # Validation Zod + helpers API
│   ├── schemas/api.ts     # Schémas Zod pour validation
│   └── logger.ts          # Logger structuré
└── public/                # Assets statiques
```

### Points Critiques

1. **`lib/bigquery.ts`** = Source unique de vérité pour données BigQuery
2. **`lib/api-helpers.ts`** = Validation Zod pour toutes les routes API
3. **`lib/schemas/api.ts`** = Schémas de validation (Zod)
4. **Routes API** = Backend Next.js (jamais exposées au client)

### Patterns Importants

**Route API Type:**
```typescript
export async function GET(request: NextRequest) {
  const params = validateQuery(searchParams, schema)
  const data = await getData(params)
  return NextResponse.json({ success: true, data })
}
```

**Composant Client:**
```typescript
'use client'
export default function Page() {
  const [data, setData] = useState([])
  useEffect(() => {
    fetch('/api/metrics/global').then(...)
  }, [])
  return <div>...</div>
}
```

---

## 🚀 Pour Développeurs - Setup Rapide

### 1. Installation

```bash
cd dashboard
npm install
```

### 2. Configuration

Créer `.env.local`:
```bash
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GCP_SA_KEY_JSON={"type":"service_account",...}
```

### 3. Lancer

```bash
npm run dev
# → http://localhost:3000
```

---

## 📚 Documentation Complète

### Architecture
- **`ARCHITECTURE.md`** - Structure complète du projet
- **`API-ROUTES.md`** - Toutes les routes API documentées
- **`COMPONENTS.md`** - Documentation des composants

### Mobile & Évolution
- **`MOBILE-FIRST-STRATEGY.md`** - Plan migration mobile
- **`MIGRATION-ZOD-COMPLETE.md`** - Validation Zod implémentée

### BigQuery
- **`lib/bigquery.ts`** - Toutes les fonctions BigQuery
- **`BIGQUERY-EXPLICATION-SIMPLE.md`** - Guide BigQuery

---

## 🔍 Trouver Rapidement

### Où chercher...

**Fonctionnalité BigQuery:**
→ `lib/bigquery.ts`

**Validation API:**
→ `lib/schemas/api.ts` (schémas)
→ `lib/api-helpers.ts` (helpers)

**Composant UI:**
→ `components/[Component].tsx`

**Route API:**
→ `app/api/[route]/route.ts`

**Page:**
→ `app/[route]/page.tsx`

**Types TypeScript:**
→ `lib/types/[domain].ts`

---

## ⚙️ Commandes Utiles

```bash
# Dev
npm run dev

# Build
npm run build

# Tests Zod
./test-zod.sh

# Lint
npm run lint
```

---

## 🐛 Debugging Rapide

### Problème: Route API ne répond pas
→ Vérifier logs serveur (`npm run dev`)
→ Vérifier validation Zod (erreur 400)

### Problème: Données BigQuery manquantes
→ Vérifier credentials `.env.local`
→ Vérifier `lib/bigquery.ts` pour la fonction appelée

### Problème: TypeScript error
→ Vérifier types dans `lib/types/`
→ Vérifier schémas Zod dans `lib/schemas/api.ts`

---

## 📝 Ajouter une Fonctionnalité

### Nouvelle Route API

1. Créer `app/api/[route]/route.ts`
2. Définir schéma dans `lib/schemas/api.ts`
3. Utiliser `validateQuery()` ou `validateBody()`
4. Retourner format standard `{success, data, meta}`
5. Documenter dans `API-ROUTES.md`

### Nouveau Composant

1. Créer `components/[Component].tsx`
2. Utiliser Tailwind mobile-first
3. Documenter props dans JSDoc
4. Ajouter dans `COMPONENTS.md`

---

## 🎯 Conventions

### Naming
- **Composants:** PascalCase (`MetricCard.tsx`)
- **Routes API:** kebab-case (`/api/metrics/global`)
- **Fonctions:** camelCase (`getGlobalMetrics`)
- **Types:** PascalCase (`SiteMetrics`)

### Code Style
- TypeScript strict mode
- Pas de `any` (sauf exception documentée)
- Logger structuré (`logger.info/error/debug`)
- Validation Zod sur tous les inputs API

---

**Pour plus de détails, voir `ARCHITECTURE.md`**

