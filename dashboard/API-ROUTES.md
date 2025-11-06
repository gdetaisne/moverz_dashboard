# 🔌 API Routes - Documentation Complète

**Toutes les routes API du dashboard, leurs paramètres, et leurs réponses.**

---

## 📋 Table des Routes

### Metrics (Google Search Console)
- `GET /api/metrics/global` - KPIs globaux
- `GET /api/metrics/timeseries` - Évolution temporelle
- `GET /api/metrics/pages` - Top pages
- `GET /api/metrics/queries` - Top requêtes

### 404 Errors
- `GET /api/404/history` - Historique erreurs 404
- `GET /api/404/last` - Dernier scan
- `GET /api/404/delta` - Différence entre scans
- `POST /api/404/crawl` - Lancer un crawl
- `POST /api/404/analyze` - Analyser résultats

### SERP
- `GET /api/serp/preview` - Prévisualisation SERP
- `POST /api/serp/audit` - Audit SERP complet

### Sites
- `GET /api/sites/[domain]` - Données par site

### Autres
- `GET /api/insights` - Insights IA
- `GET /api/gsc/issues` - Problèmes GSC
- `POST /api/chat` - Chat IA
- `POST /api/etl/run` - Lancer ETL

---

## 📊 Format Standard des Réponses

### ✅ Succès
```typescript
{
  success: true,
  data: T, // Données typées selon la route
  meta?: {
    period?: string,
    count?: number,
    site?: string,
    // ... métadonnées contextuelles
  }
}
```

### ❌ Erreur (Validation Zod)
```typescript
{
  success: false,
  error: "Validation failed",
  details: [
    {
      field: "days",
      message: "Number must be less than or equal to 365",
      code: "too_big"
    }
  ]
}
```

### ❌ Erreur (Autre)
```typescript
{
  success: false,
  error: "Error message",
  code?: string,
  stack?: string // Dev only
}
```

---

## 📡 Routes Détailées

### `GET /api/metrics/global`

**Description:** KPIs globaux agrégés de tous les sites.

**Query Params:**
- `days` (number, 1-365, default=7) - Période en jours

**Validation:** `metricsGlobalQuerySchema`

**Réponse:**
```typescript
{
  success: true,
  data: SiteMetrics[], // [{ site, clicks, impressions, ctr, position, trend_* }]
  meta: {
    period: "30 days",
    count: 11
  }
}
```

**Exemple:**
```bash
curl "http://localhost:3000/api/metrics/global?days=30"
```

---

### `GET /api/metrics/timeseries`

**Description:** Évolution temporelle des métriques.

**Query Params:**
- `days` (number, 1-365, default=7)
- `site` (string, optional) - Filtrer par site

**Validation:** `metricsTimeseriesQuerySchema`

**Réponse:**
```typescript
{
  success: true,
  data: GSCGlobalMetrics[], // [{ date, clicks, impressions, ctr, position }]
  meta: {
    site: "all" | string,
    period: "30 days",
    count: number
  }
}
```

---

### `GET /api/metrics/pages`

**Description:** Top pages par impressions.

**Query Params:**
- `site` (string, optional)
- `limit` (number, 0-10000, default=20, 0=tous)

**Validation:** `metricsPagesQuerySchema`

**Réponse:**
```typescript
{
  success: true,
  data: GSCPageMetrics[], // [{ domain, page, clicks, impressions, ctr, position }]
  meta: {
    site: "all" | string,
    limit: number,
    count: number
  }
}
```

---

### `GET /api/metrics/queries`

**Description:** Top requêtes par impressions.

**Query Params:**
- `site` (string, optional)
- `limit` (number, 1-1000, default=20)

**Validation:** `metricsQueriesQuerySchema`

---

### `GET /api/404/history`

**Description:** Historique des scans d'erreurs 404.

**Query Params:**
- `days` (number, 1-365, default=30)
- `count` (number, 1-100, default=20)
- `mode` ('last' | 'evolution', default='last')

**Validation:** `error404HistoryQuerySchema`

**Réponse:**
```typescript
{
  success: true,
  data: {
    evolution: Error404Evolution[],
    lastScan: Error404Scan | null
  },
  meta: {
    days: number,
    count: number,
    mode: string
  }
}
```

---

### `GET /api/serp/preview`

**Description:** Prévisualisation SERP pour top pages.

**Query Params:**
- `site` (string, optional)
- `limit` (number, 0-10000, default=20, 0=tous)

**Validation:** `serpPreviewQuerySchema`

**Réponse:**
```typescript
{
  success: true,
  data: SerpPreview[], // [{ url, title, description, favicon, structured_data, ... }]
  meta: {
    site: string,
    count: number,
    totalImpressions30d: number,
    limit: number
  }
}
```

**Cache:** `Cache-Control: public, max-age=0, s-maxage=21600` (6h au proxy)

---

### `POST /api/serp/audit`

**Description:** Audit SERP complet avec scoring.

**Query Params:**
- `site` (string, optional)
- `limit` (number, 1-10000, default=20)

**Validation:** `serpAuditQuerySchema`

**Body:** Aucun (pour l'instant)

**Réponse:**
```typescript
{
  success: true,
  data: {
    summary: {
      total_pages: number,
      avg_score: number,
      // ...
    },
    pages: AuditResult[]
  }
}
```

**Note:** Cette route peut être longue (crawl de pages)

---

### `POST /api/chat`

**Description:** Chat avec assistant IA.

**Body (JSON):**
```typescript
{
  message: string, // min 1 char
  mode: 'summary' | 'detail' | 'deepsearch' | 'data', // default='summary'
  context?: Record<string, unknown>,
  dataMode?: boolean
}
```

**Validation:** `chatRequestSchema`

**Réponse:**
```typescript
{
  success: true,
  data: {
    response: string,
    intent?: string,
    // ...
  }
}
```

---

## 🔒 Validation avec Zod

**Toutes les routes utilisent Zod pour validation.**

### Avantages
- ✅ Types TypeScript inférés automatiquement
- ✅ Erreurs claires avec messages détaillés
- ✅ Sécurité (pas de valeurs invalides)

### Schémas Disponibles
Voir `lib/schemas/api.ts` pour la liste complète.

### Utilisation
```typescript
import { validateQuery } from '@/lib/api-helpers'
import { metricsGlobalQuerySchema } from '@/lib/schemas/api'

const params = validateQuery(searchParams, metricsGlobalQuerySchema)
// params.days est garanti entre 1 et 365 (number)
```

---

## 🧪 Tests

**Script de test:** `test-zod.sh`

**Exécuter:**
```bash
./test-zod.sh
```

**Couverture:**
- ✅ Validation paramètres valides
- ✅ Validation paramètres invalides
- ✅ Valeurs par défaut
- ✅ Formats de réponse

---

## 📝 Ajouter une Nouvelle Route

### Checklist

1. **Créer la route** dans `app/api/[path]/route.ts`
2. **Définir le schéma Zod** dans `lib/schemas/api.ts`
3. **Utiliser `validateQuery` ou `validateBody`**
4. **Retourner format standard** (`{success, data, meta}`)
5. **Logger les erreurs** avec `logger.error()`
6. **Tester** avec le script de test
7. **Documenter** dans ce fichier

### Template
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateQuery, handleZodError } from '@/lib/api-helpers'
import type { ApiSuccessResponse } from '@/lib/api-helpers'
import { myRouteQuerySchema } from '@/lib/schemas/api'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const params = validateQuery(request.nextUrl.searchParams, myRouteQuerySchema)
    
    // Logique métier
    const data = await fetchData(params)
    
    const response: ApiSuccessResponse = {
      success: true,
      data,
      meta: { /* ... */ }
    }
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(error)
    }
    
    logger.error('[my-route] API error', error, { route: '/api/my-route' })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
```

---

**Cette documentation doit être maintenue à jour à chaque nouvelle route.**

