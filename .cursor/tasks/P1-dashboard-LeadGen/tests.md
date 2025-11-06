# Tests - P1-dashboard-LeadGen

**Tâche:** Dashboard Leads  
**Statut:** 🔄 À démarrer

---

## Tests à Effectuer

### Tests API Routes

#### `GET /api/leads`
- [ ] Sans paramètres → retourne liste par défaut
- [ ] Avec `?site=marseille` → filtre par site
- [ ] Avec `?status=pending` → filtre par status
- [ ] Avec `?startDate=2025-11-01&endDate=2025-11-06` → filtre par date
- [ ] Avec `?limit=50` → limite résultats
- [ ] Avec `?offset=100` → pagination
- [ ] Valeurs invalides → erreur 400 avec message Zod
- [ ] Format réponse : `{ success: true, data: [...], meta: {...} }`

#### `GET /api/leads/stats`
- [ ] Retourne KPIs agrégés
- [ ] Avec `?site=marseille` → stats par site
- [ ] Avec `?startDate=...&endDate=...` → stats par période
- [ ] Format réponse : `{ success: true, data: { total, conversionRate, ... } }`

#### `GET /api/leads/export`
- [ ] Export CSV fonctionne
- [ ] Export JSON fonctionne
- [ ] Filtres appliqués à l'export
- [ ] Headers CSV corrects

### Tests Interface

#### Page `/leads`
- [ ] Page se charge sans erreur
- [ ] KPIs affichés correctement
- [ ] Graphiques se chargent
- [ ] Table des leads s'affiche
- [ ] Filtres fonctionnent
- [ ] Responsive mobile OK
- [ ] États loading/error gérés

#### Composants
- [ ] `LeadsKPIs` affiche bonnes valeurs
- [ ] `LeadsChart` graphiques corrects
- [ ] `LeadsTable` trie et filtre
- [ ] `LeadsFilters` applique filtres

### Tests Performance

- [ ] Temps chargement < 2s
- [ ] Requêtes BigQuery optimisées
- [ ] Pas d'erreurs console
- [ ] Pas d'erreurs logs serveur

### Tests Validation Zod

- [ ] Valeurs valides acceptées
- [ ] Valeurs invalides rejetées (400)
- [ ] Messages d'erreur clairs
- [ ] Valeurs par défaut appliquées

---

## Résultats

**Date test:** _____________  
**Environnement:** [ ] Local [ ] Production [ ] Staging  
**Tester:** _____________

### Routes testées: ___ / 3
### Tests passés: ___ / [nombre total]
### Erreurs trouvées: ___

---

## Bugs Identifiés

*À remplir lors des tests*

---

**Ce fichier sera rempli lors des tests.**

