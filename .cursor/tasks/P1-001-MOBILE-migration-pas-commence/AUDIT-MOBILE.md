# 📱 Audit Mobile - Dashboard Moverz

**Date:** 2025-11-06  
**Phase:** Phase 1 - Audit & Infrastructure  
**Statut:** 🔄 En cours

---

## 🎯 Objectif

Identifier tous les problèmes UX sur mobile pour prioriser les corrections.

---

## 📊 Résumé Exécutif

**Composants analysés:** 15+  
**Pages analysées:** 8  
**Problèmes critiques:** 8  
**Problèmes moyens:** 5  
**Problèmes mineurs:** 3

---

## 🔴 Problèmes Critiques (Priorité 1)

### 1. Tables - DataTable & GroupedDataTable

**Fichiers concernés:**
- `components/DataTable.tsx`
- `components/GroupedDataTable.tsx`

**Problème:**
- Seulement scroll horizontal (`overflow-x-auto`)
- Colonnes trop nombreuses pour petits écrans (< 640px)
- Texte trop petit dans les cellules (`text-sm`)
- Pas de vue alternative (cards) sur mobile
- Headers non sticky lors du scroll horizontal

**Impact:** ⚠️ **ÉLEVÉ** - Tables difficiles à utiliser sur mobile

**Solution proposée:**
- Vue cards sur mobile (< md)
- Table scrollable avec sticky header sur tablette (md-lg)
- Table normale sur desktop (lg+)

**Pages affectées:**
- `/` (Home) - GroupedDataTable
- `/serp` - Table SERP preview
- `/404` - Table résultats scan
- `/gsc-issues` - Table alertes GSC

---

### 2. Graphiques - TimeSeriesChart

**Fichiers concernés:**
- `components/TimeSeriesChart.tsx`
- `components/MultiSiteTimeSeriesChart.tsx`

**Problème:**
- Hauteur fixe 300px (pas responsive)
- Tooltips pas optimisés pour tactile
- Légende peut être trop petite sur mobile
- Axes X/Y peuvent être illisibles sur très petits écrans

**Impact:** ⚠️ **MOYEN-ÉLEVÉ** - Graphiques peu lisibles sur mobile

**Solution proposée:**
- Hauteur adaptative : `h-[200px] sm:h-[250px] md:h-[300px]`
- Tooltips avec délai plus long pour tactile
- Légende simplifiée sur mobile (icônes seulement)
- Axes avec rotation si nécessaire

**Pages affectées:**
- `/` (Home) - 4 graphiques
- `/sites/[domain]` - Graphiques par site

---

### 3. Page SERP - Table Complexe

**Fichier:** `app/serp/page.tsx`

**Problème:**
- Table avec 5 colonnes (Aperçu, URL, Impr., %, Signaux)
- Colonne "Aperçu" très large (max-w-xl) - difficile sur mobile
- Boutons d'action nombreux en haut (Charger, Audit, Export)
- Grid de résumé audit (4 colonnes) pas responsive

**Impact:** ⚠️ **ÉLEVÉ** - Page difficilement utilisable sur mobile

**Solution proposée:**
- Vue cards sur mobile pour chaque résultat SERP
- Boutons empilés verticalement sur mobile
- Grid résumé audit : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

---

### 4. Page Home - Header & Actions

**Fichier:** `app/page.tsx`

**Problème:**
- Header avec boutons "Refresh" et PeriodSelector côte à côte
- Boutons peuvent être trop petits sur mobile (< 44x44px)
- Grid KPI cards déjà responsive mais peut être amélioré
- Modals plein écran utilisent `w-[95vw] h-[95vh]` - peut être mieux

**Impact:** ⚠️ **MOYEN** - Utilisable mais peut être amélioré

**Solution proposée:**
- Header empilé verticalement sur mobile
- Boutons plus grands : `min-h-[44px]` (Apple HIG)
- Modals avec padding mobile optimisé

---

### 5. Navigation - Menu Mobile

**Fichier:** `components/Navigation.tsx`

**Problème:**
- Menu mobile existe déjà (`isMobileOpen`)
- À vérifier : taille des liens, espacement tactile
- Menu peut être trop long sur petits écrans

**Impact:** ⚠️ **MOYEN** - Fonctionne mais à optimiser

**Solution proposée:**
- Vérifier taille liens (min 44x44px)
- Ajouter séparateurs visuels
- Scroll si menu trop long

---

### 6. ChatBot - Composant Flottant

**Fichier:** `components/ChatBot.tsx`

**Problème:**
- Bouton flottant en bas à droite (`bottom-6 right-6`)
- Peut être difficile à atteindre sur mobile
- Fenêtre chat peut être trop grande sur mobile
- Resize pas adapté mobile

**Impact:** ⚠️ **MOYEN** - Utilisable mais UX perfectible

**Solution proposée:**
- Bouton plus grand sur mobile
- Fenêtre chat en plein écran sur mobile (< md)
- Désactiver resize sur mobile

---

### 7. Page 404 - Table Résultats Scan

**Fichier:** `app/404/page.tsx`

**Problème:**
- Table avec nombreuses colonnes
- Filtres et actions nombreux
- Pas de vue mobile optimisée

**Impact:** ⚠️ **MOYEN** - Page complexe, difficile sur mobile

**Solution proposée:**
- Vue cards pour résultats scan sur mobile
- Filtres en modal sur mobile

---

### 8. Page GSC Issues - Table Alertes

**Fichier:** `app/gsc-issues/page.tsx`

**Problème:**
- Table avec colonnes multiples
- Filtres et actions nombreux
- Pas de vue mobile optimisée

**Impact:** ⚠️ **MOYEN** - Page complexe, difficile sur mobile

**Solution proposée:**
- Vue cards pour alertes sur mobile
- Filtres en modal sur mobile

---

## 🟡 Problèmes Moyens (Priorité 2)

### 9. MetricCard - Grille Responsive

**Fichier:** `components/MetricCard.tsx`

**État actuel:** ✅ Déjà responsive (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`)

**Amélioration possible:**
- Espacement entre cards sur mobile
- Tailles texte déjà adaptatives (`text-3xl sm:text-4xl`)

**Impact:** ⚠️ **FAIBLE** - Déjà bien fait

---

### 10. Modals Plein Écran

**Fichiers:** `app/page.tsx` (modals graphiques)

**Problème:**
- Utilisent `w-[95vw] h-[95vh]` - peut être mieux
- Padding peut être insuffisant sur mobile

**Solution proposée:**
- `w-full h-full sm:w-[95vw] sm:h-[95vh]` sur mobile
- Padding adaptatif : `p-2 sm:p-4`

---

### 11. Formulaires & Inputs

**Fichiers:** `app/settings/page.tsx`, `app/serp/page.tsx`

**Problème:**
- Inputs peuvent être trop petits sur mobile
- Labels et inputs pas toujours bien alignés

**Solution proposée:**
- Inputs full-width sur mobile
- Labels au-dessus des inputs sur mobile
- Taille texte adaptative

---

## 🟢 Problèmes Mineurs (Priorité 3)

### 12. Textes & Typographie

**Problème:**
- Certains textes peuvent être trop petits sur mobile
- Line-height peut être amélioré

**Solution proposée:**
- Vérifier tailles texte minimales (16px minimum)
- Line-height adaptatif

---

### 13. Espacements & Padding

**Problème:**
- Certains composants ont padding fixe
- Espacements peuvent être optimisés pour mobile

**Solution proposée:**
- Padding adaptatif : `p-4 sm:p-6`
- Espacements cohérents avec breakpoints

---

### 14. Touch Targets

**Problème:**
- Certains boutons/liens peuvent être < 44x44px

**Solution proposée:**
- Audit complet des éléments interactifs
- Assurer min 44x44px (Apple HIG)

---

## 📋 Checklist Audit

### Composants Core
- [x] DataTable - ⚠️ Critique
- [x] GroupedDataTable - ⚠️ Critique
- [x] TimeSeriesChart - ⚠️ Moyen-Élevé
- [x] MetricCard - ✅ OK (améliorations mineures)
- [x] Navigation - ✅ OK (vérifications à faire)
- [x] ChatBot - ⚠️ Moyen

### Pages
- [x] Home (`/`) - ⚠️ Moyen
- [x] SERP (`/serp`) - ⚠️ Critique
- [x] Sites (`/sites/[domain]`) - ⚠️ Moyen
- [x] 404 (`/404`) - ⚠️ Moyen
- [x] GSC Issues (`/gsc-issues`) - ⚠️ Moyen
- [x] Insights (`/insights`) - À vérifier
- [x] Settings (`/settings`) - À vérifier

---

## 🎯 Plan d'Action Recommandé

### Phase 2 - Composants Core (Semaine 2-3)

1. **DataTable** - Vue cards mobile (P1)
2. **TimeSeriesChart** - Hauteur responsive + tooltips tactiles (P1)
3. **GroupedDataTable** - Vue cards mobile (P1)
4. **Navigation** - Vérifications UX très petits écrans (P2)
5. **ChatBot** - Optimisation mobile (P2)

### Phase 3 - Pages Spécifiques (Semaine 4)

1. **Page SERP** - Vue cards + boutons empilés (P1)
2. **Page Home** - Header responsive (P2)
3. **Page 404** - Vue cards résultats (P2)
4. **Page GSC Issues** - Vue cards alertes (P2)
5. **Page Settings** - Formulaires responsive (P2)

---

## 📊 Métriques de Succès

### Performance Mobile
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Lighthouse Score Mobile > 90

### UX Mobile
- [ ] Tous éléments cliquables > 44x44px
- [ ] Lisibilité texte sans zoom
- [ ] Navigation intuitive
- [ ] Tables utilisables (cards ou scroll optimisé)

### Tests
- [ ] Testé sur iPhone (Safari)
- [ ] Testé sur Android (Chrome)
- [ ] Testé sur tablette (iPad)
- [ ] Tests Lighthouse passent

---

**Audit complété le 2025-11-06. Prêt pour Phase 2.**

