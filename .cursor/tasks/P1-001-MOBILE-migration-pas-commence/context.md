# Contexte Technique - P1-001-MOBILE-migration-pas-commence

**Tâche:** Migration mobile-first complète  
**Statut:** 📋 À faire

---

## Contexte Projet

Le dashboard Moverz est actuellement optimisé principalement pour desktop. Bien que certaines classes responsive existent, il n'y a pas de stratégie mobile-first cohérente.

**Objectif:** Adapter le dashboard pour une utilisation optimale sur mobile (smartphones et tablettes).

---

## État Actuel

### Responsive Actuel
- ✅ Navigation avec menu mobile (`Navigation.tsx`)
- ✅ Quelques classes Tailwind responsive (`sm:`, `md:`)
- ✅ Scroll horizontal sur tables (`overflow-x-auto`)
- ✅ Tailles texte adaptatives (`text-3xl sm:text-4xl`)

### Limitations Identifiées
- ⚠️ Pas de stratégie mobile-first cohérente
- ⚠️ Tables difficiles à utiliser sur très petits écrans
- ⚠️ Graphiques peuvent être petits sur mobile
- ⚠️ Pas de touch gestures optimisés
- ⚠️ Pas de PWA (Progressive Web App)
- ⚠️ Certains composants pas optimisés mobile

---

## Stratégie Choisie

### Option A: Adaptation Progressive (Recommandée) ✅

**Avantages:**
- ✅ Maintenance simple (une seule codebase)
- ✅ Pas de duplication de logique
- ✅ Évolution progressive possible

**Approche:**
- Refactoriser composants un par un
- Utiliser Tailwind mobile-first
- Tester sur appareils réels à chaque étape

### Option B: Version Dédiée (Non choisie)

Raisons d'exclusion:
- Maintenance double trop complexe
- Risque de divergence entre versions
- Code dupliqué

---

## Breakpoints à Définir

```typescript
// tailwind.config.ts
screens: {
  'xs': '475px',  // Très petits mobiles
  'sm': '640px',  // Mobiles landscape / petits tablettes
  'md': '768px',  // Tablettes
  'lg': '1024px', // Desktop petit
  'xl': '1280px', // Desktop
  '2xl': '1536px' // Desktop large
}
```

---

## Composants Prioritaires

### Phase 2 (Core)
1. **DataTable** - Critique (tables difficiles sur mobile)
2. **TimeSeriesChart** - Important (graphiques petits)
3. **MetricCard** - Déjà partiellement fait (vérifier cohérence)
4. **Navigation** - Déjà fait (vérifier UX très petits écrans)

### Phase 3 (Pages)
1. **Home** - Page principale, beaucoup de trafic
2. **Sites** - Tables à adapter
3. **SERP** - Prévisualisation importante
4. **Settings** - Formulaires

---

## Contraintes

- **Compatibilité:** Maintenir compatibilité desktop (pas de régression)
- **Performance:** Ne pas dégrader les performances
- **Temps:** 2-3 semaines estimées (4 phases)

---

## Risques Identifiés

1. **Régressions desktop**
   - **Mitigation:** Tester desktop à chaque modification
   - **Mitigation:** Utiliser classes responsive (ne pas remplacer)

2. **Performance mobile**
   - **Mitigation:** Lazy loading composants lourds
   - **Mitigation:** Code splitting par route

3. **Complexité maintenabilité**
   - **Mitigation:** Documentation claire des changements
   - **Mitigation:** Patterns établis dans COMPONENTS.md

---

## Outils & Ressources

### Testing
- Chrome DevTools (mode mobile)
- BrowserStack (tests multi-appareils)
- Lighthouse (audit performance mobile)

### Libraries Utiles
- `react-use-gesture` - Touch gestures
- `react-intersection-observer` - Lazy loading
- `next-pwa` - PWA support

### Documentation
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Web.dev Mobile-First](https://web.dev/responsive-web-design-basics/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

---

**Contexte technique documenté. Prêt pour Phase 1 (audit).**

