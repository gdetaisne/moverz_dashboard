# 📘 Zod en Simple - Guide pour le Dashboard

## 🎯 Zod, c'est quoi ?

**Zod = un validateur de données qui génère automatiquement des types TypeScript**

Au lieu d'écrire manuellement :
```typescript
const days = parseInt(...)
if (days < 1 || days > 365) { ... }
```

Tu écris :
```typescript
const days = z.number().min(1).max(365).parse(rawValue)
// ✅ Zod vérifie ET TypeScript sait que c'est un nombre valide
```

---

## 💡 Exemple 1 : Validation d'une query string

### ❌ AVANT (actuel)
```typescript
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const days = parseInt(searchParams.get('days') || '7', 10)
  const site = searchParams.get('site') || undefined
  
  // ❌ Problèmes :
  // - days pourrait être NaN si l'utilisateur envoie "abc"
  // - days pourrait être négatif (-100)
  // - days pourrait être énorme (999999)
  // - Pas de type garanti
}
```

### ✅ APRÈS (avec Zod)
```typescript
import { z } from 'zod'

// 1. Définir le schéma (une fois, réutilisable)
const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
  site: z.string().min(1).optional(),
})

export async function GET(request: NextRequest) {
  try {
    // 2. Valider (Zod convertit automatiquement et vérifie)
    const params = querySchema.parse({
      days: searchParams.get('days'),
      site: searchParams.get('site'),
    })
    
    // ✅ params.days est GARANTI d'être un nombre entier entre 1 et 365
    // ✅ params.site est soit une string non-vide, soit undefined
    // ✅ TypeScript connaît le type automatiquement !
    
    const data = await getGlobalMetrics(params.days)
    // ...
  } catch (error) {
    // Zod lance une erreur claire si la validation échoue
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        success: false, 
        error: error.errors[0].message 
      }, { status: 400 })
    }
  }
}
```

---

## 💡 Exemple 2 : Validation d'un body JSON

### ❌ AVANT
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { message, mode } = body
  
  // ❌ Rien ne garantit que body.message existe
  // ❌ Rien ne garantit que mode est une des valeurs attendues
  // ❌ TypeScript ne peut pas inférer les types
}
```

### ✅ APRÈS (avec Zod)
```typescript
const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message requis'),
  mode: z.enum(['summary', 'detail', 'deepsearch']).default('summary'),
  dataMode: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const params = chatRequestSchema.parse(body)
    
    // ✅ params.message est GARANTI d'être une string non-vide
    // ✅ params.mode est GARANTI d'être 'summary' | 'detail' | 'deepsearch'
    // ✅ params.dataMode est soit boolean soit undefined
    
    // Utiliser params avec confiance
    if (params.mode === 'summary') {
      // TypeScript sait que c'est 'summary' ici !
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        success: false, 
        error: 'Validation failed',
        details: error.errors 
      }, { status: 400 })
    }
  }
}
```

---

## 🔧 Types Zod de Base

```typescript
import { z } from 'zod'

// String
z.string()                    // N'importe quelle string
z.string().min(3)            // String de 3+ caractères
z.string().email()           // Email valide
z.string().url()             // URL valide

// Number
z.number()                   // N'importe quel nombre
z.number().int()             // Nombre entier seulement
z.number().min(0).max(100)   // Entre 0 et 100
z.coerce.number()            // Convertit automatiquement "123" → 123

// Boolean
z.boolean()                  // true ou false
z.coerce.boolean()           // Convertit "true" → true

// Date
z.date()                     // Date valide
z.coerce.date()              // Convertit string → Date

// Enum (valeurs autorisées)
z.enum(['option1', 'option2'])  // Seulement 'option1' ou 'option2'

// Optional (peut être absent)
z.string().optional()        // string | undefined

// Default (valeur par défaut si absent)
z.string().default('toto')   // Si absent, utilise 'toto'

// Array
z.array(z.string())          // Array de strings
z.array(z.number()).min(1)   // Array avec au moins 1 élément
```

---

## 📦 Exemple Complet : Route API avec Zod

```typescript
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-helpers'

// 1. Définir le schéma (au début du fichier)
const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
  site: z.string().min(1).optional(),
})

// 2. Utiliser dans la route
export async function GET(request: NextRequest) {
  try {
    // 3. Valider les query params
    const params = querySchema.parse({
      days: request.nextUrl.searchParams.get('days'),
      site: request.nextUrl.searchParams.get('site'),
    })
    
    // 4. Utiliser params avec confiance totale
    const data = await getGlobalMetrics(params.days)
    
    return NextResponse.json({
      success: true,
      data,
      meta: {
        days: params.days,  // TypeScript sait que c'est un number
        site: params.site,  // TypeScript sait que c'est string | undefined
      }
    })
  } catch (error) {
    // Gérer les erreurs Zod
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid parameters',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      }, { status: 400 })
    }
    
    // Autres erreurs
    return handleApiError(error, { route: '/api/metrics/global' })
  }
}
```

---

## 🎁 Bonus : Réutiliser les schémas

```typescript
// lib/schemas/api.ts
import { z } from 'zod'

// Schémas réutilisables
export const commonQuerySchema = {
  days: z.coerce.number().int().min(1).max(365).default(7),
  site: z.string().min(1).optional(),
}

export const paginationSchema = {
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}

// Utiliser partout
const metricsQuerySchema = z.object({
  ...commonQuerySchema,
  ...paginationSchema,
})
```

---

## 🚀 Avantages pour le Dashboard

1. **Sécurité** : Empêche les valeurs invalides d'arriver dans le code
2. **Type safety** : TypeScript connaît automatiquement les types validés
3. **Moins de bugs** : Plus de `NaN`, de nombres négatifs inattendus, etc.
4. **Messages d'erreur clairs** : Zod dit exactement ce qui ne va pas
5. **Moins de code** : Fini les `if (days < 1) { ... }` partout

---

## 📝 Résumé Ultra Simple

**Zod = un garde-fou pour tes données**

```
Données brutes (non fiables)
    ↓
[Zod vérifie et convertit]
    ↓
Données propres (fiables + typées)
```

**Exemple :**
- Input utilisateur : `"abc"` pour `days`
- Zod dit : ❌ "days doit être un nombre"
- Input utilisateur : `"30"` pour `days`
- Zod dit : ✅ "OK, voici 30 (number)"
- TypeScript sait : `days` est un `number`

---

**C'est aussi simple que ça ! 😊**

