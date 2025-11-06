# 🧩 Composants - Documentation

**Tous les composants React réutilisables du dashboard.**

---

## 📋 Liste des Composants

### Core UI
- `Navigation.tsx` - Menu principal avec mobile menu
- `MetricCard.tsx` - Carte KPI avec tendance
- `PageIntro.tsx` - Introduction de page avec contexte

### Data Display
- `DataTable.tsx` - Tableau de données avec tri
- `GroupedDataTable.tsx` - Tableau groupé
- `TimeSeriesChart.tsx` - Graphique évolution temporelle
- `MultiSiteTimeSeriesChart.tsx` - Graphique multi-sites

### Specialized
- `Error404Analysis.tsx` - Analyse erreurs 404
- `Error404Evolution.tsx` - Évolution erreurs 404
- `InsightCard.tsx` - Carte insight IA
- `PersistentChat.tsx` - Chat IA persistant
- `ChatBot.tsx` - Widget chat IA
- `PeriodSelector.tsx` - Sélecteur de période

### Utility
- `Tooltip.tsx` - Tooltip réutilisable
- `AnimatedFavicon.tsx` - Favicon animé

---

## 🔧 Composants Détailés

### `Navigation.tsx`

**Rôle:** Menu principal avec navigation mobile.

**Props:** Aucune (utilise `usePathname()`)

**Features:**
- Menu hamburger mobile (`isMobileOpen`)
- Navigation desktop/tablette
- Tooltips contextuels avec info pages
- Icons Lucide React

**Usage:**
```tsx
import { Navigation } from '@/components/Navigation'

// Dans layout.tsx
<Navigation />
```

**Mobile:**
- Menu hamburger → drawer slide-in
- Liens empilés verticalement
- Touch-friendly (44x44px minimum)

---

### `MetricCard.tsx`

**Rôle:** Affiche un KPI avec tendance.

**Props:**
```typescript
interface MetricCardProps {
  title: string
  value: string | number
  trend?: number // Pourcentage de variation
  format?: 'number' | 'percent' | 'position'
  icon?: React.ReactNode
}
```

**Features:**
- Format adaptatif (number, percent, position)
- Couleur tendance intelligente (position inversée)
- Responsive: `text-3xl sm:text-4xl`

**Usage:**
```tsx
<MetricCard
  title="Impressions"
  value={1234567}
  trend={5.2}
  format="number"
  icon={<Eye />}
/>
```

**Responsive:**
- Mobile: `text-3xl` (plus petit)
- Desktop: `text-4xl` (plus grand)
- Card: `p-6` partout

---

### `DataTable.tsx`

**Rôle:** Tableau de données générique avec tri.

**Props:**
```typescript
interface DataTableProps<T extends Record<string, any>> {
  data: T[]
  columns: Column<T>[]
}

interface Column<T> {
  key: keyof T | string
  label: string
  format?: 'number' | 'percent' | 'date' | 'text'
  sortable?: boolean
}
```

**Features:**
- Tri multi-colonnes
- Formats automatiques (number, percent, date)
- Scroll horizontal sur mobile (`overflow-x-auto`)

**Usage:**
```tsx
<DataTable
  data={pages}
  columns={[
    { key: 'page', label: 'Page', sortable: true },
    { key: 'impressions', label: 'Impressions', format: 'number', sortable: true },
    { key: 'ctr', label: 'CTR', format: 'percent', sortable: true },
  ]}
/>
```

**Mobile Limitation:**
⚠️ Tables difficiles sur très petits écrans. À améliorer avec vue cards.

---

### `TimeSeriesChart.tsx`

**Rôle:** Graphique évolution temporelle (Recharts).

**Props:**
```typescript
interface TimeSeriesChartProps {
  data: GSCGlobalMetrics[]
  metric: 'clicks' | 'impressions' | 'ctr' | 'position'
}
```

**Features:**
- Chart Recharts responsive
- Format de date adaptatif
- Tooltips interactifs

**Usage:**
```tsx
<TimeSeriesChart
  data={timeseriesData}
  metric="impressions"
/>
```

**Responsive:**
- Container: `ResponsiveContainer` (100% width)
- Hauteur adaptative selon contexte

---

### `ChatBot.tsx`

**Rôle:** Widget chat IA intégré.

**Props:**
```typescript
interface ChatBotProps {
  isOpen?: boolean
  onToggle?: () => void
}
```

**Features:**
- Modal resizable
- Modes: small, medium, fullscreen
- Persistence localStorage
- Integration OpenAI

**Usage:**
```tsx
// Bouton flottant (fermé)
<ChatBot isOpen={false} onToggle={() => setOpen(true)} />

// Modal ouvert
<ChatBot isOpen={true} onToggle={() => setOpen(false)} />
```

**Mobile:**
- Bouton flottant: `fixed bottom-6 right-6`
- Modal: Fullscreen sur mobile, taille adaptative tablette

---

### `Error404Evolution.tsx`

**Rôle:** Affichage évolution erreurs 404.

**Props:**
```typescript
interface Error404EvolutionProps {
  evolution: Error404Evolution[]
  lastScan: Error404Scan | null
}
```

**Features:**
- Graphique évolution temporelle
- Détails scan récent
- Actions suggérées

---

### `PeriodSelector.tsx`

**Rôle:** Sélecteur de période (7, 30, 90 jours).

**Props:**
```typescript
interface PeriodSelectorProps {
  value: number
  onChange: (days: number) => void
}
```

**Features:**
- Options pré-définies
- Design cohérent

**Usage:**
```tsx
<PeriodSelector
  value={period}
  onChange={setPeriod}
/>
```

---

## 🎨 Patterns de Design

### Responsive

**Mobile-First:**
```tsx
// ✅ Bon
<div className="p-4 sm:p-6 lg:p-8">

// ❌ À éviter
<div className="p-8 sm:p-4">
```

**Grille Responsive:**
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

**Affichage Conditionnel:**
```tsx
{/* Desktop */}
<div className="hidden md:block">...</div>

{/* Mobile */}
<div className="block md:hidden">...</div>
```

### Colors & Spacing

**Couleurs:**
- Primary: `primary-500` (blue)
- Success: `green-600`
- Error: `red-600`
- Text: `slate-900` (dark), `slate-600` (light)

**Spacing:**
- Cards: `p-6`
- Sections: `py-6 sm:py-8`
- Container: `px-3 sm:px-4`

---

## 🔮 Composants Futurs (À Créer)

### Mobile-Optimized
- `MobileDataCard.tsx` - Card view pour tables sur mobile
- `MobileNavigation.tsx` - Navigation mobile optimisée
- `TouchSlider.tsx` - Slider tactile pour périodes

### Performance
- `LazyChart.tsx` - Chart avec lazy loading
- `VirtualizedList.tsx` - Liste virtualisée pour grandes données

### UX
- `LoadingSkeleton.tsx` - Skeleton loading
- `ErrorBoundary.tsx` - Gestion erreurs React
- `ConfirmationModal.tsx` - Modal de confirmation

---

## 📝 Ajouter un Nouveau Composant

### Checklist

1. **Créer fichier** `components/[Component].tsx`
2. **Définir props** avec TypeScript
3. **Utiliser Tailwind** mobile-first
4. **Documenter props** avec JSDoc
5. **Tester responsive** (mobile, tablette, desktop)
6. **Ajouter** dans ce fichier

### Template

```tsx
'use client' // Si besoin de hooks React

import { cn } from '@/lib/utils'

interface MyComponentProps {
  title: string
  value: number
  className?: string
}

/**
 * Description du composant
 * 
 * @param title - Titre affiché
 * @param value - Valeur numérique
 */
export function MyComponent({ title, value, className }: MyComponentProps) {
  return (
    <div className={cn('bg-white p-6 rounded-lg', className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-3xl">{value}</p>
    </div>
  )
}
```

---

**Cette documentation doit être maintenue à jour à chaque nouveau composant.**

