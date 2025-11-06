# 🏗️ Architecture du Dashboard Moverz

**Dernière mise à jour:** 2025-01-XX  
**Framework:** Next.js 14 (App Router)  
**Language:** TypeScript (strict mode)

---

## 📐 Vue d'Ensemble

```
dashboard/
├── app/                      # Next.js App Router (pages + API routes)
│   ├── [page].tsx           # Pages publiques (Server Components par défaut)
│   ├── api/                 # API Routes (Backend Next.js)
│   │   ├── metrics/         # Données Google Search Console
│   │   ├── 404/             # Gestion erreurs 404
│   │   ├── serp/            # Analyse SERP
│   │   ├── chat/            # Assistant IA
│   │   └── ...
│   ├── layout.tsx           # Layout racine (Navigation, Chat)
│   └── globals.css          # Styles globaux Tailwind
│
├── components/              # Composants React réutilisables
│   ├── Navigation.tsx      # Menu principal (avec mobile menu)
│   ├── MetricCard.tsx      # Carte KPI
│   ├── DataTable.tsx       # Tableau de données
│   ├── TimeSeriesChart.tsx # Graphique évolution temporelle
│   ├── ChatBot.tsx         # Assistant IA intégré
│   └── ...
│
├── lib/                     # Bibliothèques et utilitaires
│   ├── bigquery.ts          # ⭐ CŒUR: Client BigQuery + toutes les queries
│   ├── logger.ts            # Logger structuré (pino)
│   ├── api-helpers.ts       # Helpers pour routes API (Zod, erreurs)
│   ├── schemas/             # Schémas Zod pour validation
│   │   └── api.ts           # Tous les schémas de validation API
│   ├── serp-utils.ts        # Utilitaires analyse SERP
│   ├── types/               # Types TypeScript partagés
│   │   └── gsc.ts           # Types Google Search Console
│   └── utils.ts             # Helpers généraux (format, etc.)
│
└── public/                  # Assets statiques
```

---

## 🎯 Principes Architecturaux

### 1. **Server Components First**
- **Par défaut**: Toutes les pages sont des Server Components
- **Client Components**: Seulement si nécessaire (`'use client'`)
- **Avantages**: Moins de JavaScript côté client, meilleures perfs

### 2. **API Routes = Backend**
- Les routes `/app/api/*` sont le backend Next.js
- Elles sont **jamais exposées directement** au client (sécurité)
- Elles communiquent avec BigQuery, OpenAI, etc.

### 3. **Validation Centralisée**
- **Zod** pour validation de tous les inputs API
- Schémas centralisés dans `lib/schemas/api.ts`
- Helpers standardisés dans `lib/api-helpers.ts`

### 4. **Logger Structuré**
- **pino** pour tous les logs
- Remplace tous les `console.log/error`
- Configurable par environnement

### 5. **Types Stricts**
- TypeScript strict mode
- Types centralisés dans `lib/types/`
- Pas de `any` (sauf cas exceptionnels documentés)

---

## 📡 Flux de Données

### Architecture Actuelle

```
[BigQuery] 
    ↓ (via @google-cloud/bigquery)
[API Routes (/app/api/*)]
    ↓ (fetch)
[Client Components ('use client')]
    ↓ (props)
[UI Components]
```

### Exemple Concret

1. **Page** (`app/page.tsx`) charge via `useEffect`
2. **Fetch** → `/api/metrics/global?days=30`
3. **API Route** (`app/api/metrics/global/route.ts`) :
   - Valide avec Zod (`metricsGlobalQuerySchema`)
   - Appelle `getGlobalMetrics()` depuis `lib/bigquery.ts`
   - Retourne JSON standardisé
4. **Page** met à jour le state et affiche les composants

---

## 🔑 Fichiers Clés

### `lib/bigquery.ts` ⭐ CŒUR DU SYSTÈME

**Rôle:** Toute la logique BigQuery centralisée

**Exports principaux:**
- `getBigQueryClient()` : Client BigQuery unique (singleton)
- `getGlobalMetrics(days)` : KPIs globaux
- `getTopPages(site, limit)` : Top pages GSC
- `getError404Evolution()` : Historique erreurs 404
- `getTimeSeriesData()` : Données temporelles

**Pattern:**
```typescript
export async function getGlobalMetrics(days: number): Promise<SiteMetrics[]> {
  const bigquery = getBigQueryClient()
  // Query BigQuery
  // Format & retourne données typées
}
```

### `lib/api-helpers.ts`

**Rôle:** Helpers pour toutes les routes API

**Fonctions:**
- `validateQuery()` : Validation query params avec Zod
- `validateBody()` : Validation body JSON avec Zod
- `handleZodError()` : Format erreurs validation
- `handleApiError()` : Format erreurs générales

**Usage:**
```typescript
import { validateQuery, handleZodError } from '@/lib/api-helpers'
import { metricsGlobalQuerySchema } from '@/lib/schemas/api'

const params = validateQuery(searchParams, metricsGlobalQuerySchema)
// params.days est garanti entre 1 et 365 (TypeScript le sait !)
```

### `lib/schemas/api.ts`

**Rôle:** Tous les schémas Zod pour validation

**Structure:**
```typescript
// Schémas réutilisables
export const commonQuerySchema = {
  days: z.coerce.number().int().min(1).max(365).default(7),
  site: z.string().min(1).optional(),
}

// Schémas par route
export const metricsGlobalQuerySchema = z.object({
  days: commonQuerySchema.days,
})
```

---

## 🎨 Patterns UI

### Composants Réutilisables

#### `MetricCard`
- Affiche un KPI avec tendance
- Format: `number` | `percent` | `position`
- Responsive: `text-3xl sm:text-4xl`

#### `DataTable`
- Tableau générique avec tri
- Colonnes configurables
- Scroll horizontal sur mobile (`overflow-x-auto`)

#### `TimeSeriesChart`
- Graphique Recharts
- Responsive container
- Format de date adaptatif

#### `Navigation`
- Menu principal avec mobile menu
- Liens avec tooltips contextuels
- State management local (`isMobileOpen`)

---

## 🔐 Sécurité

### API Routes
- ✅ Validation Zod sur tous les inputs
- ✅ Pas d'exposition des credentials BigQuery au client
- ✅ Logger structuré (pas de logs sensibles en prod)

### Variables d'Environnement
- `.env.local` (gitignored) pour credentials
- Variables requises documentées dans README

---

## 📊 Gestion d'État

### Client Components
- **useState** pour état local
- **useEffect** pour fetch au montage
- **useCallback** pour mémorisation fonctions

### Pas de State Management Global (pour l'instant)
- Redux/Zustand non utilisé actuellement
- Peut être ajouté si complexification

### Cache
- Headers `Cache-Control` sur certaines API routes
- Pas de cache client-side explicite (à considérer)

---

## 🚀 Performance

### Optimisations Actuelles
- Server Components par défaut
- Code splitting automatique (Next.js)
- Images optimisées (`next/image`)

### Optimisations Futures
- React Query / SWR pour cache API
- Suspense boundaries
- Virtual scrolling pour grandes listes

---

## 📱 Responsive Design (État Actuel)

### Classes Tailwind Utilisées
- `sm:` (640px+)
- `md:` (768px+) - rarement utilisé
- `lg:` (1024px+) - rarement utilisé

### Composants Responsive
- ✅ `Navigation` : Menu mobile (`isMobileOpen`)
- ✅ `MetricCard` : Tailles texte adaptatives
- ✅ `DataTable` : Scroll horizontal sur mobile
- ⚠️ **Manque**: Stratégie mobile-first cohérente

### Limitations Actuelles
- Pas de breakpoints cohérents partout
- Certains composants pas optimisés mobile
- Tables peuvent être difficiles à utiliser sur petit écran

---

## 🔮 Évolution Future

### Complexification Prévue
1. **Fonctionnalités additionnelles**
   - Plus de types d'analyses
   - Plus de données sources
   - Intégrations externes

2. **State Management**
   - Possible besoin Redux/Zustand
   - Cache API plus sophistiqué

3. **Composants**
   - Système de design plus structuré
   - Storybook pour documentation composants

### Mobile-First Strategy (À Implémenter)

**Option A: Adaptation Progressive**
- Refactoriser composants un par un
- Utiliser Tailwind mobile-first (`sm:` pour desktop)
- Composants adaptatifs (`hidden sm:block`)

**Option B: Version Dédiée**
- `/mobile` route avec layout différent
- Composants spécifiques mobile
- API partagée

**Recommandation:** Option A (moins de maintenance)

---

## 📚 Documentation Connexe

- `ARCHITECTURE.md` ← **Tu es ici**
- `README.md` - Guide démarrage rapide
- `MOBILE-FIRST-STRATEGY.md` - Plan migration mobile
- `API-ROUTES.md` - Documentation complète API
- `COMPONENTS.md` - Documentation composants
- `BIGQUERY-SCHEMA.md` - Structure données BigQuery

---

**Cette architecture évoluera avec le projet. Cette documentation doit être maintenue à jour.**

