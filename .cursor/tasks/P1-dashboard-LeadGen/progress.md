# Progression - P1-dashboard-LeadGen

**Tâche:** Dashboard Leads  
**Statut:** 🔄 À démarrer

---

## Journal des Sessions

### 2025-11-06 - Création Tâche

**Fait:**
- Structure de la tâche créée
- Documentation initiale rédigée
- Objectifs et critères de succès définis

**Prochaine étape:**
- Analyser structure données BigQuery
- Créer route API `/api/leads`
- Créer page `/leads`

---

## Checklist Progression

### Phase 1: Infrastructure API
- [ ] Analyser structure table `analytics_core.leads` dans BigQuery
- [ ] Créer schémas Zod pour validation (`lib/schemas/api.ts`)
- [ ] Créer route API `GET /api/leads` avec filtres
- [ ] Créer route API `GET /api/leads/stats` pour KPIs
- [ ] Créer route API `GET /api/leads/export` pour export
- [ ] Tests routes API (validation, erreurs)

### Phase 2: Composants UI
- [ ] Créer composant `LeadsKPIs` (cartes métriques)
- [ ] Créer composant `LeadsChart` (graphiques évolution)
- [ ] Créer composant `LeadsTable` (liste des leads)
- [ ] Créer composant `LeadsFilters` (filtres)
- [ ] Adapter composants existants si nécessaire

### Phase 3: Page Dashboard
- [ ] Créer page `/leads` avec layout
- [ ] Intégrer composants KPIs, graphiques, table
- [ ] Ajouter lien dans navigation
- [ ] Gérer états loading/error
- [ ] Responsive mobile-first

### Phase 4: Tests & Optimisation
- [ ] Tests automatisés routes API
- [ ] Tests manuels interface
- [ ] Optimisation requêtes BigQuery
- [ ] Performance (< 2s chargement)
- [ ] Documentation

---

## Notes

- Commencer par Phase 1 (API) pour avoir les données
- Tester régulièrement avec données réelles
- Itérer rapidement sur l'UI

---

**Tâche créée. Prêt à démarrer Phase 1.**

