# 📚 Documentation Complète - Dashboard Moverz

**Index central de toute la documentation du projet.**

---

## 🎯 Pour Cursor (IA) - Lecture Ultra-Rapide

### ⚡ Quick Start (2 minutes)
👉 **`QUICK-START.md`** - Structure, patterns, et points critiques

**Résumé ultra-rapide:**
- `lib/bigquery.ts` = Cœur du système (toutes les queries)
- `lib/api-helpers.ts` = Validation Zod centralisée
- Routes API = Backend Next.js (jamais exposé au client)
- Server Components par défaut, Client Components si besoin

---

## 📐 Architecture & Structure

### 🏗️ Architecture Complète
**`ARCHITECTURE.md`** - Structure détaillée du projet

**Contenu:**
- Structure des dossiers expliquée
- Principes architecturaux
- Flux de données
- Fichiers clés documentés
- Patterns UI
- Sécurité et performance
- Évolution future

**À lire si:** Tu dois comprendre l'organisation globale du projet

---

## 🔌 Routes API

### **`API-ROUTES.md`** - Toutes les routes API documentées

**Contenu:**
- Liste complète des routes
- Format standard des réponses
- Paramètres et validation Zod
- Exemples d'utilisation
- Template pour nouvelles routes

**À lire si:** Tu dois modifier ou créer une route API

**Routes principales:**
- `/api/metrics/*` - Données Google Search Console
- `/api/404/*` - Gestion erreurs 404
- `/api/serp/*` - Analyse SERP
- `/api/chat` - Assistant IA

---

## 🧩 Composants UI

### **`COMPONENTS.md`** - Documentation des composants

**Contenu:**
- Liste tous les composants
- Props et usage de chaque composant
- Patterns de design responsive
- Template pour nouveaux composants

**À lire si:** Tu dois créer ou modifier un composant UI

**Composants principaux:**
- `Navigation.tsx` - Menu avec mobile menu
- `MetricCard.tsx` - Carte KPI
- `DataTable.tsx` - Tableau avec tri
- `TimeSeriesChart.tsx` - Graphique évolution
- `ChatBot.tsx` - Widget IA

---

## 📱 Mobile-First Strategy

### **`MOBILE-FIRST-STRATEGY.md`** - Plan migration mobile

**Contenu:**
- État actuel (ce qui fonctionne / limitations)
- Option A: Adaptation progressive (recommandée)
- Option B: Version dédiée mobile
- Guidelines design mobile-first
- Plan d'action phase par phase
- Checklist migration

**À lire si:** Tu dois adapter le dashboard pour mobile

---

## 🔍 Navigation Rapide

### Je veux...

**Comprendre rapidement le projet:**
→ `QUICK-START.md` (5 min)

**Comprendre la structure complète:**
→ `ARCHITECTURE.md` (15 min)

**Modifier une route API:**
→ `API-ROUTES.md` + `ARCHITECTURE.md` (sections API)

**Créer une nouvelle route API:**
→ `API-ROUTES.md` (template) + `lib/schemas/api.ts`

**Modifier un composant:**
→ `COMPONENTS.md` + code existant

**Créer un nouveau composant:**
→ `COMPONENTS.md` (template)

**Comprendre BigQuery:**
→ `lib/bigquery.ts` (commenté) + `BIGQUERY-EXPLICATION-SIMPLE.md`

**Comprendre validation Zod:**
→ `EXEMPLE-ZOD.md` + `lib/schemas/api.ts`

**Adapter pour mobile:**
→ `MOBILE-FIRST-STRATEGY.md`

**Comprendre les migrations:**
→ `MIGRATION-ZOD-COMPLETE.md` + autres fichiers `MIGRATION-*.md`

---

## 📂 Organisation des Fichiers

### Documentation
- `README.md` - Vue d'ensemble et setup
- `QUICK-START.md` - Guide rapide ⚡
- `ARCHITECTURE.md` - Architecture complète 🏗️
- `API-ROUTES.md` - Routes API 🔌
- `COMPONENTS.md` - Composants 🧩
- `MOBILE-FIRST-STRATEGY.md` - Plan mobile 📱
- `DOCUMENTATION.md` ← **Tu es ici**

### Migrations & Historique
- `MIGRATION-ZOD-COMPLETE.md` - Migration Zod
- `MIGRATION-BIGQUERY-FUNCTIONS.md` - Migration BigQuery
- `ANALYSE-AMELIORATIONS.md` - Améliorations identifiées

### BigQuery & Technique
- `BIGQUERY-EXPLICATION-SIMPLE.md` - Guide BigQuery
- `EXEMPLE-ZOD.md` - Guide Zod
- `DEPLOY-GUIDE.md` - Déploiement

---

## 🎯 Points Clés à Retenir

### Pour Cursor (IA)

1. **`lib/bigquery.ts`** = Source unique de vérité pour données
2. **Validation Zod** = Toutes les routes API utilisent Zod
3. **Server Components** = Par défaut, Client Components si besoin
4. **Mobile-First** = En cours de migration (voir stratégie)

### Patterns Récurrents

**Route API:**
```typescript
const params = validateQuery(searchParams, schema)
const data = await getData(params)
return NextResponse.json({ success: true, data })
```

**Composant Client:**
```typescript
'use client'
const [data, setData] = useState([])
useEffect(() => { fetch('/api/...') }, [])
```

**Responsive:**
```typescript
<div className="p-4 sm:p-6 lg:p-8"> // Mobile-first
```

---

## 🔄 Maintenance de la Documentation

**Règles:**
- ✅ Toute nouvelle route API → Documenter dans `API-ROUTES.md`
- ✅ Tout nouveau composant → Documenter dans `COMPONENTS.md`
- ✅ Changement architecture → Mettre à jour `ARCHITECTURE.md`
- ✅ Nouvelle fonctionnalité → Ajouter dans `QUICK-START.md` si critique

**Fréquence:**
- Documentation technique: Après chaque feature majeure
- Documentation architecture: Lors de refactoring important
- Quick Start: À chaque changement de pattern

---

## 📊 Statistiques Documentation

- **5 fichiers** de documentation principale
- **~1500 lignes** de documentation totale
- **100% routes API** documentées
- **100% composants** documentés

---

## 🚀 Prochaines Étapes

1. **Implémenter mobile-first** → Suivre `MOBILE-FIRST-STRATEGY.md`
2. **Migrer autres routes Zod** → Utiliser templates dans `API-ROUTES.md`
3. **Créer composants manquants** → Utiliser templates dans `COMPONENTS.md`
4. **Optimiser performance** → Voir section Performance dans `ARCHITECTURE.md`

---

**Cette documentation est vivante. Elle doit être maintenue à jour avec le projet.**

