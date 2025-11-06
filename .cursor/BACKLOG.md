# 📋 Backlog - Dashboard Moverz

**Liste partagée de toutes les tâches identifiées.**

**Légende:** 📋 À faire | 🔄 En cours | ⚠️ INCOMPLET | ❌ ABANDONNÉE | ✅ FINALISÉ

**Priorités:** P0 (critique) → P1 (important) → P2 (normal) → P3 (nice-to-have)

---

## ⚠️ INCOMPLET (Toujours Prioritaire)

*Aucune tâche incomplète pour l'instant.*

---

## 🔄 En Cours

*Aucune tâche en cours pour l'instant.*

---

## 📋 À Faire

### P0 - Critique

*Aucune tâche P0 pour l'instant.*

---

### P1 - Important

#### P1-001-MOBILE-migration-pas-commence

**Statut:** 📋 À faire  
**Priorité:** P1  
**ID:** 001  
**Domaine:** MOBILE  
**Assigné:** Guillaume  
**Estimation:** 2-3 semaines (4 phases)  
**Créée:** 2025-01-XX

**Description:**
Implémenter la migration mobile-first complète selon le plan détaillé dans `MOBILE-FIRST-STRATEGY.md`.

**Phases:**
1. Audit & Infrastructure (breakpoints, composants utilitaires)
2. Composants Core (Navigation, Tables, Graphiques, Cards)
3. Pages Spécifiques (Home, Sites, SERP, Settings)
4. Optimisations Avancées (PWA, touch gestures, lazy loading)

**Critères de succès:**
- ✅ Tous les composants optimisés mobile
- ✅ Tables → Cards sur mobile
- ✅ Tests sur iPhone, Android, tablette
- ✅ Lighthouse Score Mobile > 90
- ✅ Pas de régression desktop

**Références:**
- `MOBILE-FIRST-STRATEGY.md`

---

#### P1-002-API-ZOD-migration-restantes-pas-commence

**Statut:** 📋 À faire  
**Priorité:** P1  
**ID:** 002  
**Domaine:** API  
**Assigné:** Guillaume  
**Estimation:** 1-2 jours  
**Créée:** 2025-01-XX

**Description:**
Migrer les routes API restantes vers Zod pour validation complète.

**Routes à migrer:**
- `/api/gsc/issues`
- `/api/insights`
- `/api/chat` (POST avec body)
- `/api/sites/[domain]`
- `/api/404/crawl` (POST)
- `/api/404/analyze` (POST)
- `/api/seo/check/*`
- `/api/etl/run`
- `/api/vitals`
- `/api/settings/strategy`

**Critères de succès:**
- ✅ Toutes les routes API utilisent Zod
- ✅ Schémas documentés dans `lib/schemas/api.ts`
- ✅ Tests automatisés passent pour toutes les routes
- ✅ Format de réponse standardisé partout

**Références:**
- `API-ROUTES.md`
- `MIGRATION-ZOD-COMPLETE.md`

---

### P2 - Normal

#### P2-003-PERF-optimisation-pas-commence

**Statut:** 📋 À faire  
**Priorité:** P2  
**ID:** 003  
**Domaine:** PERF  
**Assigné:** Guillaume  
**Estimation:** 3-5 jours  
**Créée:** 2025-01-XX

**Description:**
Optimiser les performances du dashboard (loading, caching, code splitting).

**Améliorations prévues:**
- React Query / SWR pour cache API
- Suspense boundaries
- Virtual scrolling pour grandes listes
- Lazy loading composants lourds
- Code splitting par route

**Critères de succès:**
- ✅ First Contentful Paint < 1.5s
- ✅ Time to Interactive < 3s
- ✅ Lighthouse Score > 90
- ✅ Réduction bundle size

---

#### P2-004-MOBILE-PWA-setup-pas-commence

**Statut:** 📋 À faire  
**Priorité:** P2  
**ID:** 004  
**Domaine:** MOBILE  
**Assigné:** Guillaume  
**Estimation:** 2-3 jours  
**Créée:** 2025-01-XX

**Description:**
Transformer le dashboard en PWA (manifest, service worker, offline).

**Critères de succès:**
- ✅ Manifest.json configuré
- ✅ Service Worker fonctionnel
- ✅ Installation possible sur mobile
- ✅ Cache offline pour pages statiques
- ✅ Notifications si nécessaire

**Références:**
- `MOBILE-FIRST-STRATEGY.md` (Phase 4)

---

### P3 - Nice-to-Have

#### P3-005-DEV-Storybook-setup-pas-commence

**Statut:** 📋 À faire  
**Priorité:** P3  
**ID:** 005  
**Domaine:** DEV  
**Assigné:** Guillaume  
**Estimation:** 2-3 jours  
**Créée:** 2025-01-XX

**Description:**
Mettre en place Storybook pour documenter et tester les composants visuellement.

**Critères de succès:**
- ✅ Storybook configuré
- ✅ Stories pour composants principaux
- ✅ Documentation props dans Storybook
- ✅ Tests visuels (Chromatic si possible)

---

## ✅ FINALISÉ

#### P1-000-DOC-ZOD-migration-termine

**Statut:** ✅ FINALISÉ  
**Priorité:** P1  
**ID:** 000  
**Domaine:** DOC  
**Assigné:** Guillaume  
**Finalisée:** 2025-01-XX

**Description:**
Créer documentation complète du projet et migrer routes API vers Zod.

**Résultats:**
- ✅ 6 fichiers de documentation créés (~1600 lignes)
- ✅ 7 routes API migrées avec Zod
- ✅ Infrastructure validation en place
- ✅ Tests automatisés fonctionnels

**Commits:** c46ea0c

---

## ❌ ABANDONNÉE

*Aucune tâche abandonnée pour l'instant.*

---

**Dernière mise à jour:** 2025-01-XX

