# P1-001-MOBILE-migration-pas-commence

**Statut:** 🔄 En cours  
**Priorité:** P1  
**Créée:** 2025-01-XX  
**Assignée:** Guillaume  
**Estimation:** 2-3 semaines (4 phases)

---

## 📋 Objectifs

Implémenter la migration mobile-first complète selon le plan détaillé dans `MOBILE-FIRST-STRATEGY.md`.

**Stratégie choisie:** Option A - Adaptation Progressive (recommandée)

---

## 🎯 Phases de Travail

### Phase 1: Audit & Infrastructure (Semaine 1) ✅ TERMINÉE
- [x] Audit complet des composants non-optimisés mobile
- [x] Documenter problèmes UX identifiés
- [x] Définir breakpoints standardisés dans `tailwind.config.ts`
- [ ] Tester sur différents appareils (iPhone, Android, tablette) - À faire en Phase 2
- [ ] Créer composants utilitaires responsive - À faire si nécessaire en Phase 2

### Phase 2: Composants Core (Semaine 2-3)
**Priorité 1: Navigation**
- [x] Menu mobile existe déjà (vérifier UX très petits écrans)

**Priorité 2: Tables (DataTable.tsx)**
- [ ] Adapter pour mobile (cards view ou scroll optimisé)
- [ ] Sticky header si scroll horizontal
- [ ] Touch-friendly interactions

**Priorité 3: Graphiques (TimeSeriesChart.tsx, etc.)**
- [ ] Adapter hauteur selon breakpoint
- [ ] Simplifier légende sur mobile
- [ ] Tooltips tactiles optimisés

**Priorité 4: Cards KPI (MetricCard.tsx)**
- [ ] Grille responsive (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)
- [ ] Tailles texte adaptatives déjà faites (vérifier cohérence)

### Phase 3: Pages Spécifiques (Semaine 4)
- [ ] Page Home (`app/page.tsx`)
  - Grille responsive pour MetricCards
  - Graphiques empilés verticalement sur mobile
  
- [ ] Page Sites (`app/sites/page.tsx`)
  - Liste cards sur mobile au lieu de table
  - Filtres en modal sur mobile
  
- [ ] Page SERP (`app/serp/page.tsx`)
  - Preview SERP adapté mobile
  - Boutons d'audit plus accessibles
  
- [ ] Page Settings (`app/settings/page.tsx`)
  - Formulaire optimisé mobile

### Phase 4: Optimisations Avancées (Semaine 5+)
- [ ] PWA setup (manifest, service worker)
- [ ] Touch gestures (swipe pour navigation)
- [ ] Lazy loading (images et composants lourds)
- [ ] Performance optimization (code splitting)

---

## ✅ Critères de Succès

### Performance Mobile
- ✅ First Contentful Paint < 1.5s sur mobile
- ✅ Time to Interactive < 3s sur mobile
- ✅ Lighthouse Score Mobile > 90

### UX Mobile
- ✅ Tous les éléments cliquables > 44x44px (Apple HIG)
- ✅ Lisibilité texte sans zoom
- ✅ Navigation intuitive sur mobile
- ✅ Tables utilisables sur mobile (cards ou scroll optimisé)

### Fonctionnalités
- ✅ Toutes les fonctionnalités accessibles sur mobile
- ✅ Pas de perte d'information sur petit écran
- ✅ Pas de régression desktop

### Tests
- ✅ Testé sur iPhone (Safari)
- ✅ Testé sur Android (Chrome)
- ✅ Testé sur tablette (iPad)
- ✅ Tests Lighthouse passent

---

## 📊 Métriques de Succès

- **Performance:** Lighthouse Score Mobile > 90
- **UX:** Tous les éléments interactifs accessibles
- **Compatibilité:** Tests sur 3+ appareils réels
- **Régression:** Aucune régression desktop détectée

---

## 🔗 Références

- **Plan détaillé:** `MOBILE-FIRST-STRATEGY.md`
- **Documentation composants:** `COMPONENTS.md`
- **Guidelines Tailwind:** Documentation Tailwind responsive design

---

## 📝 Notes

- Commencer par Phase 1 (audit) pour identifier exactement ce qui doit être fait
- Tester régulièrement sur appareils réels
- Itérer rapidement
- Garder desktop fonctionnel à chaque étape

---

**Tâche créée. Prêt à démarrer Phase 1.**

