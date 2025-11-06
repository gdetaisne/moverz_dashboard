# 🔍 Analyse Situation - Dashboard Clics GSC

**Date:** 2025-11-06  
**Rôle:** Directeur Lead Management  
**Contexte:** 11 sites mis en ligne le 1er octobre 2025  
**Objectif:** Analyser les **clics GSC** (pas les leads de formulaires)

---

## 📊 État Actuel des Données

### ⚠️ Constat Principal

**La table `gsc_daily_aggregated` doit être vérifiée dans BigQuery.**

Pour vérifier :
1. Exécuter l'ETL GSC : `npx tsx etl/gsc/fetch-simple.ts`
2. Vérifier que les 11 sites sont trackés dans Google Search Console
3. Relancer l'analyse : `npx tsx .cursor/tasks/P1-dashboard-LeadGen/analyse-clics-gsc.ts`

---

## 🎯 Objectifs du Dashboard Clics GSC

En tant que directeur Lead Management, j'ai besoin de :

1. **Vérifier que les 11 sites fonctionnent bien**
   - Tous les sites génèrent-ils des clics ?
   - Y a-t-il des sites avec des problèmes de tracking GSC ?

2. **S'assurer que les métadonnées sont propres**
   - Données GSC complètes (clics, impressions, CTR, position)
   - Données exploitables pour analyses CTR
   - Vérifier la qualité des données

3. **Analyser le CTR et les performances**
   - CTR moyen par site
   - Position moyenne par site
   - Évolution temporelle des clics

4. **Regrouper les données (faible volume)**
   - Agrégations par semaine/mois plutôt que par jour si volume faible
   - Périodes d'analyse adaptées au volume

---

## 📋 Structure Dashboard Recommandée

### Vue d'Ensemble (Page `/leads`)

#### Section 1: KPIs Principaux

**Métriques à afficher :**
- **Total Clics** (depuis le 1er octobre)
- **Total Impressions**
- **CTR Moyen** (clics / impressions)
- **Position Moyenne**
- **Clics par Site** (répartition)

**Agrégation recommandée :**
- Si volume < 100 clics : Regrouper par semaine
- Si volume >= 100 clics : Analyses quotidiennes possibles
- Période par défaut : 30 jours minimum

#### Section 2: Graphiques Temporels

**Graphiques à afficher :**
- **Évolution des Clics** (ligne temporelle)
  - Si volume faible : Par semaine
  - Si volume acceptable : Par jour
- **Évolution des Impressions** (ligne temporelle)
- **Évolution du CTR** (ligne temporelle)
- **Évolution de la Position** (ligne temporelle)

#### Section 3: Analyse par Site

**Pour chaque site :**
- Nombre de clics
- Nombre d'impressions
- CTR
- Position moyenne
- Évolution temporelle
- Statut (✅ données présentes / ❌ pas de données)

#### Section 4: Tableau Comparatif

**Tableau avec colonnes :**
- Site
- Clics (total)
- Impressions (total)
- CTR (%)
- Position moyenne
- Dernière date de données
- Jours avec données

**Filtres disponibles :**
- Site (dropdown multi-select)
- Date (date range picker)
- Période (7j, 30j, 90j, Tout)

---

## 🎨 Design Adapté au Faible Volume

### Stratégie de Regroupement

**Si volume < 100 clics :**

1. **Agrégations par Semaine**
   - Graphiques : Semaine plutôt que jour
   - Tableau : Grouper par semaine avec sous-totaux

2. **Périodes d'Analyse**
   - Par défaut : 30 jours minimum
   - Options : 7 jours, 30 jours, 90 jours, Tout

3. **Affichage Conditionnel**
   - Si < 10 clics : Afficher "Données insuffisantes"
   - Si 10-50 clics : Afficher avec avertissement "Volume faible"
   - Si > 50 clics : Affichage normal

### Métriques Calculées

**CTR :**
```
CTR = (clics / impressions) * 100
```

**Performance par Site :**
```
Performance = (clics_site / total_clics) * 100
```

**Tendance :**
```
Tendance = ((clics_periode_actuelle - clics_periode_precedente) / clics_periode_precedente) * 100
```

---

## 🔍 Checklist Qualité des Données

### Vérifications à Effectuer

- [ ] **Volume de données**
  - [ ] Au moins 1 clic par site (11 sites)
  - [ ] Volume total > 0 depuis le 1er octobre
  - [ ] Données récentes (derniers 7 jours)

- [ ] **Complétude par site**
  - [ ] Tous les 11 sites ont des données GSC
  - [ ] Pas de sites avec 0 clic (vérifier tracking GSC)
  - [ ] Permissions GSC correctes pour tous les sites

- [ ] **Qualité des métriques**
  - [ ] CTR calculé correctement (clics / impressions)
  - [ ] Position moyenne cohérente
  - [ ] Pas de valeurs aberrantes

---

## 📊 Requêtes SQL Recommandées

### 1. Vue d'Ensemble (KPIs)

```sql
SELECT 
  SUM(clicks) as total_clicks,
  SUM(impressions) as total_impressions,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 as avg_ctr,
  AVG(position) as avg_position,
  COUNT(DISTINCT domain) as sites_count
FROM `moverz-dashboard.analytics_core.gsc_daily_aggregated`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
```

### 2. Répartition par Site

```sql
SELECT 
  domain as site,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 as ctr,
  AVG(position) as avg_position
FROM `moverz-dashboard.analytics_core.gsc_daily_aggregated`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY domain
ORDER BY clicks DESC
```

### 3. Évolution Temporelle (par semaine si volume faible)

```sql
SELECT 
  DATE_TRUNC(date, WEEK) as week,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 as ctr,
  AVG(position) as avg_position
FROM `moverz-dashboard.analytics_core.gsc_daily_aggregated`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY week
ORDER BY week DESC
```

### 4. Statut par Site (vérifier les 11 sites)

```sql
SELECT 
  domain as site,
  MAX(date) as last_date,
  COUNT(DISTINCT date) as days_with_data,
  SUM(clicks) as total_clicks
FROM `moverz-dashboard.analytics_core.gsc_daily_aggregated`
WHERE date >= '2025-10-01'
GROUP BY domain
ORDER BY domain
```

---

## 🚀 Plan d'Implémentation

### Phase 1: Vérification Données (URGENT)

1. ✅ Vérifier que l'ETL GSC a été exécuté
2. ✅ Vérifier table BigQuery `gsc_daily_aggregated`
3. ✅ Relancer analyse-clics-gsc.ts pour voir les données réelles
4. ✅ Vérifier que les 11 sites ont des données

### Phase 2: API Routes

1. Créer `GET /api/leads` avec validation Zod (renommer en `/api/clicks` si préféré)
2. Créer `GET /api/leads/stats` pour KPIs
3. Créer `GET /api/leads/by-site` pour analyse par site
4. Créer `GET /api/leads/export` pour export CSV/JSON
5. Tests des routes API

### Phase 3: Composants UI

1. Créer `ClicksKPIs` (cartes métriques : clics, impressions, CTR, position)
2. Créer `ClicksChart` (graphiques évolution)
3. Créer `ClicksBySite` (tableau répartition par site)
4. Créer `ClicksFilters` (filtres : site, date, période)

### Phase 4: Page Dashboard

1. Créer page `/leads` (ou `/clicks`)
2. Intégrer tous les composants
3. Ajouter lien dans navigation
4. Gérer états loading/error
5. Responsive mobile-first

---

## 📝 Notes Importantes

### Volume Faible = Regroupement Nécessaire

**Si volume < 100 clics :**
- Utiliser agrégations par semaine plutôt que par jour
- Périodes d'analyse : 30 jours minimum
- Afficher avertissement "Volume faible" dans le dashboard

### Sites à Vérifier

**11 sites attendus :**
- devis-demenageur-marseille.fr
- devis-demenageur-strasbourg.fr
- devis-demenageur-lille.fr
- devis-demenageur-rennes.fr
- devis-demenageur-rouen.fr
- devis-demenageur-nice.fr
- devis-demenageur-nantes.fr
- devis-demenageur-toulousain.fr
- devis-demenageur-lyon.fr
- bordeaux-demenageur.fr
- devis-demenageur-montpellier.fr

### Métadonnées GSC

**Données disponibles :**
- `date` : Date de la métrique
- `domain` : Domaine du site
- `clicks` : Nombre de clics
- `impressions` : Nombre d'impressions
- `ctr` : Taux de clic (clics / impressions)
- `position` : Position moyenne dans les résultats

**Pas de métadonnées UTM dans GSC :**
- GSC ne fournit pas de données UTM
- Les métadonnées UTM sont dans les leads de formulaires (pas dans ce dashboard)

---

## ✅ Prochaines Étapes

1. **Immédiat :** Vérifier ETL GSC et relancer analyse
2. **Court terme :** Voir les données réelles et adapter le dashboard
3. **Moyen terme :** Construire le dashboard selon cette analyse
4. **Long terme :** Optimiser selon le volume réel de données

---

**Document créé le 2025-11-06. À mettre à jour après vérification ETL GSC et exécution analyse.**

