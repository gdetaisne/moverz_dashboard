# 📊 Résumé Exécutif - Analyse Dashboard LeadGen

**Date:** 2025-11-06  
**Rôle:** Directeur Lead Management  
**Sites:** 11 sites mis en ligne le 1er octobre 2025

---

## 🎯 Objectif

Construire un dashboard LeadGen parfait pour :
1. Vérifier que les 11 sites fonctionnent bien
2. S'assurer que les métadonnées sont propres et CTR analysables
3. Analyser les conversions avec regroupement adapté au faible volume

---

## ⚠️ Constat Principal

**La table `leads` n'existe pas encore dans BigQuery.**

**Impact :**
- Aucune donnée disponible actuellement pour le dashboard
- L'ETL `etl/leads/sync.ts` n'a probablement pas été exécuté
- Impossible de faire une analyse des données réelles

---

## ✅ Actions Immédiates Requises

### 1. Vérifier PostgreSQL

**Vérifier que PostgreSQL contient des leads depuis le 1er octobre :**

```sql
SELECT COUNT(*) as total_leads
FROM leads
WHERE DATE(created_at) >= '2025-10-01';
```

**Vérifier répartition par site :**

```sql
SELECT site, COUNT(*) as count
FROM leads
WHERE DATE(created_at) >= '2025-10-01'
GROUP BY site
ORDER BY count DESC;
```

### 2. Exécuter l'ETL

**Lancer la synchronisation PostgreSQL → BigQuery :**

```bash
cd /Users/guillaumestehelin/moverz_dashboard-2
npx tsx etl/leads/sync.ts
```

**Prérequis :**
- `DATABASE_URL` configuré (PostgreSQL)
- `GCP_PROJECT_ID`, `BQ_DATASET`, `GCP_SA_KEY_JSON` configurés

### 3. Relancer l'Analyse

**Après l'ETL, relancer l'analyse pour voir les données réelles :**

```bash
npx tsx .cursor/tasks/P1-dashboard-LeadGen/analyse-donnees.ts
```

---

## 📊 Structure Dashboard Recommandée

### Vue d'Ensemble (`/leads`)

#### KPIs Principaux
- **Total Leads** (depuis le 1er octobre)
- **Taux de Conversion** (converted / total)
- **Leads par Site** (répartition)
- **Taux de Complétude Métadonnées** (% avec UTM ou source)

#### Graphiques
- **Évolution des Leads** (ligne temporelle)
  - Si volume faible : Par semaine
  - Si volume acceptable : Par jour
- **Répartition par Status** (camembert)
- **Répartition par Source** (barres horizontales)

#### Liste des Leads
- Tableau avec filtres : Site, Date, Status, Source, Campaign
- Colonnes : Date, Site, Source/UTM, Medium, Campaign, Status

#### Analyses par Site
- Pour chaque site : Nombre de leads, Taux de conversion, Top sources, Top campagnes

---

## 🎨 Adaptation au Faible Volume

### Stratégie de Regroupement

**Si volume < 50 leads :**

1. **Agrégations par Semaine**
   - Graphiques : Semaine plutôt que jour
   - Tableau : Grouper par semaine avec sous-totaux

2. **Périodes d'Analyse**
   - Par défaut : 30 jours minimum
   - Options : 7 jours, 30 jours, 90 jours, Tout

3. **Affichage Conditionnel**
   - Si < 5 leads : "Données insuffisantes"
   - Si 5-20 leads : Avertissement "Volume faible"
   - Si > 20 leads : Affichage normal

---

## 🔍 Checklist Qualité des Données

### Vérifications à Effectuer

- [ ] **Volume de données**
  - [ ] Au moins 1 lead par site (11 sites)
  - [ ] Volume total > 0 depuis le 1er octobre
  - [ ] Données récentes (derniers 7 jours)

- [ ] **Qualité métadonnées**
  - [ ] Au moins 80% des leads ont UTM ou source
  - [ ] UTM source bien renseigné
  - [ ] UTM medium bien renseigné
  - [ ] UTM campaign présent si campagnes actives

- [ ] **Complétude par site**
  - [ ] Tous les 11 sites ont généré des leads
  - [ ] Pas de sites avec 0 lead (vérifier tracking)

- [ ] **Status des leads**
  - [ ] Status bien renseignés (pending, contacted, converted, lost)
  - [ ] Pas de leads avec status NULL

---

## 🚀 Plan d'Implémentation

### Phase 1: Préparation Données (URGENT) ⚠️

1. ✅ Vérifier PostgreSQL contient des leads
2. ✅ Exécuter ETL leads/sync.ts
3. ✅ Vérifier table BigQuery créée
4. ✅ Relancer analyse-donnees.ts pour voir les données

### Phase 2: API Routes

1. Créer `GET /api/leads` avec validation Zod
2. Créer `GET /api/leads/stats` pour KPIs
3. Créer `GET /api/leads/export` pour export CSV/JSON
4. Tests des routes API

### Phase 3: Composants UI

1. Créer `LeadsKPIs` (cartes métriques)
2. Créer `LeadsChart` (graphiques)
3. Créer `LeadsTable` (liste avec filtres)
4. Créer `LeadsFilters` (filtres)

### Phase 4: Page Dashboard

1. Créer page `/leads`
2. Intégrer tous les composants
3. Ajouter lien dans navigation
4. Tests responsive

---

## 📋 Fichiers Créés

1. **`README.md`** - Vue d'ensemble de la tâche
2. **`ANALYSE-SITUATION.md`** - Analyse détaillée complète
3. **`analyse-donnees.ts`** - Script d'analyse BigQuery
4. **`RESUME-EXECUTIF.md`** - Ce document (résumé exécutif)
5. **`context.md`** - Contexte technique
6. **`progress.md`** - Journal de progression
7. **`commits.md`** - Liste des commits
8. **`tests.md`** - Plan de tests

---

## ⏭️ Prochaines Étapes

1. **Immédiat :** Vérifier PostgreSQL et exécuter ETL
2. **Court terme :** Relancer analyse pour voir les données réelles
3. **Moyen terme :** Construire le dashboard selon cette analyse
4. **Long terme :** Optimiser selon le volume réel de données

---

**Résumé créé le 2025-11-06. Voir `ANALYSE-SITUATION.md` pour les détails complets.**

