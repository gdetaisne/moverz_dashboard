# Contexte Technique - P1-dashboard-LeadGen

**Tâche:** Dashboard Leads  
**Statut:** 🔄 À démarrer

---

## Contexte Projet

Le dashboard Moverz est un dashboard analytics Next.js 14 pour visualiser les données de Google Search Console pour 11 sites du réseau Moverz.

**Objectif de cette tâche:** Ajouter un dashboard complet pour visualiser et analyser les leads générés par les sites.

---

## Contexte Technique

### Architecture Actuelle

- **Framework:** Next.js 14 (App Router)
- **TypeScript:** Strict mode
- **Validation:** Zod (infrastructure en place)
- **Logging:** Logger structuré (pino)
- **Database:** BigQuery (via @google-cloud/bigquery)

### Données Leads Disponibles

**Table BigQuery:** `analytics_core.leads`

**Schéma:**
```typescript
interface Lead {
  id: string
  created_at: Date
  site: City  // ex: "marseille", "lyon", etc.
  source: string  // ex: "google", "direct", etc.
  medium?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  form_data: Record<string, any>  // JSON
  status: 'pending' | 'contacted' | 'converted' | 'lost'
}
```

**ETL:** Les leads sont synchronisés depuis PostgreSQL vers BigQuery via `etl/leads/sync.ts`

---

## Décisions Techniques

### Choix Architecture

**Page unique `/leads` avec sections:**
- Section KPIs (cartes en haut)
- Section graphiques (évolution temporelle)
- Section liste (tableau avec filtres)

**Raison:** Simplicité, tout visible en un coup d'œil, navigation facile.

### Validation Zod

**Utiliser l'infrastructure existante:**
- `lib/schemas/api.ts` - Ajouter schémas leads
- `lib/api-helpers.ts` - Utiliser validateQuery, validateBody
- Format standardisé : `{ success: boolean, data: T, meta?: {...} }`

### Composants Réutilisables

**Utiliser composants existants:**
- `MetricCard` - Pour les KPIs
- `TimeSeriesChart` - Pour graphiques évolution
- `DataTable` - Pour liste des leads (ou adapter)
- `Navigation` - Ajouter lien `/leads`

---

## Contraintes

- **Performance:** Requêtes BigQuery optimisées (limites, index)
- **UX:** Responsive mobile-first
- **Compatibilité:** Maintenir compatibilité avec code existant
- **Régression:** Aucune régression tolérée

---

## Risques Identifiés

1. **Performance BigQuery:** Risque de requêtes lentes si beaucoup de leads
   - **Mitigation:** Pagination, limites, cache si nécessaire

2. **Données manquantes:** Risque que certains leads n'aient pas tous les champs
   - **Mitigation:** Gestion valeurs nulles, valeurs par défaut

3. **Complexité filtres:** Risque de requêtes complexes avec multiples filtres
   - **Mitigation:** Requêtes optimisées, index BigQuery

---

## Références

- **Infrastructure Zod:** `dashboard/lib/schemas/api.ts`
- **Helpers API:** `dashboard/lib/api-helpers.ts`
- **Composants:** `dashboard/components/`
- **Exemple route API:** `dashboard/app/api/metrics/global/route.ts`
- **Exemple page:** `dashboard/app/sites/page.tsx`

---

**Contexte technique complet documenté.**

