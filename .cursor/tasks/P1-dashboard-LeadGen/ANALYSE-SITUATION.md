# 🔍 Analyse Situation - Dashboard LeadGen

**Date:** 2025-11-06  
**Rôle:** Directeur Lead Management  
**Contexte:** 11 sites mis en ligne le 1er octobre 2025

---

## 📊 État Actuel des Données

### ❌ Constat Principal

**La table `leads` n'existe pas encore dans BigQuery.**

Cela signifie que :
- Les leads ne sont pas encore synchronisés depuis PostgreSQL vers BigQuery
- L'ETL `etl/leads/sync.ts` n'a probablement pas été exécuté
- Aucune donnée n'est disponible pour le dashboard actuellement

---

## 🎯 Objectifs du Dashboard LeadGen

En tant que directeur Lead Management, j'ai besoin de :

1. **Vérifier que les 11 sites fonctionnent bien**
   - Tous les sites génèrent-ils des leads ?
   - Y a-t-il des sites avec des problèmes de tracking ?

2. **S'assurer que les métadonnées sont propres**
   - Tracking UTM (source, medium, campaign) complet
   - Source/medium bien capturés
   - Données exploitables pour analyses CTR

3. **Analyser le CTR et les conversions**
   - Taux de conversion par site
   - Performance par source/campagne
   - Funnel de conversion (impressions → clics → leads)

4. **Regrouper les données (faible volume)**
   - Agrégations par semaine/mois plutôt que par jour
   - Périodes d'analyse adaptées au volume

---

## 🔧 Actions Immédiates Requises

### 1. Vérifier PostgreSQL

**Vérifier que PostgreSQL contient des leads :**

```sql
-- Compter les leads depuis le 1er octobre
SELECT COUNT(*) as total_leads
FROM leads
WHERE DATE(created_at) >= '2025-10-01';

-- Répartition par site
SELECT site, COUNT(*) as count
FROM leads
WHERE DATE(created_at) >= '2025-10-01'
GROUP BY site
ORDER BY count DESC;

-- Vérifier les métadonnées
SELECT 
  COUNT(*) as total,
  COUNT(utm_source) as has_utm_source,
  COUNT(utm_medium) as has_utm_medium,
  COUNT(utm_campaign) as has_utm_campaign,
  COUNT(source) as has_source,
  COUNT(medium) as has_medium
FROM leads
WHERE DATE(created_at) >= '2025-10-01';
```

### 2. Exécuter l'ETL Leads

**Lancer la synchronisation PostgreSQL → BigQuery :**

```bash
# Depuis la racine du projet
cd /Users/guillaumestehelin/moverz_dashboard-2

# Vérifier les variables d'environnement
# DATABASE_URL doit pointer vers PostgreSQL
# GCP_PROJECT_ID, BQ_DATASET, GCP_SA_KEY_JSON doivent être configurés

# Exécuter l'ETL pour une date spécifique
npx tsx etl/leads/sync.ts

# Ou pour une date donnée (ex: hier)
# Le script utilise getYesterday() par défaut
```

### 3. Vérifier la Table BigQuery

**Après l'ETL, vérifier que la table existe :**

```sql
-- Vérifier l'existence de la table
SELECT table_name
FROM `moverz-dashboard.analytics_core.INFORMATION_SCHEMA.TABLES`
WHERE table_name = 'leads';

-- Compter les leads
SELECT COUNT(*) as total
FROM `moverz-dashboard.analytics_core.leads`
WHERE DATE(created_at) >= '2025-10-01';
```

---

## 📋 Structure Dashboard Recommandée

### Vue d'Ensemble (Page `/leads`)

#### Section 1: KPIs Principaux

**Métriques à afficher :**
- **Total Leads** (depuis le 1er octobre)
- **Taux de Conversion** (converted / total)
- **Leads par Site** (répartition)
- **Taux de Complétude Métadonnées** (% avec UTM ou source)

**Agrégation recommandée :**
- Si volume < 50 leads : Regrouper par semaine
- Si volume >= 50 leads : Analyses quotidiennes possibles
- Période par défaut : 30 jours minimum

#### Section 2: Graphiques Temporels

**Graphiques à afficher :**
- **Évolution des Leads** (ligne temporelle)
  - Si volume faible : Par semaine
  - Si volume acceptable : Par jour
- **Répartition par Status** (camembert)
- **Répartition par Source** (barres horizontales)

#### Section 3: Liste des Leads

**Tableau avec colonnes :**
- Date
- Site
- Source / UTM Source
- Medium / UTM Medium
- Campaign (UTM Campaign)
- Status
- Actions (voir détails)

**Filtres disponibles :**
- Site (dropdown multi-select)
- Date (date range picker)
- Status (pending, contacted, converted, lost)
- Source (dropdown)
- Campaign (dropdown)

#### Section 4: Analyses par Site

**Pour chaque site :**
- Nombre de leads
- Taux de conversion
- Top sources
- Top campagnes
- Évolution temporelle

---

## 🎨 Design Adapté au Faible Volume

### Stratégie de Regroupement

**Si volume < 50 leads :**

1. **Agrégations par Semaine**
   - Graphiques : Semaine plutôt que jour
   - Tableau : Grouper par semaine avec sous-totaux

2. **Périodes d'Analyse**
   - Par défaut : 30 jours minimum
   - Options : 7 jours, 30 jours, 90 jours, Tout

3. **Affichage Conditionnel**
   - Si < 5 leads : Afficher "Données insuffisantes"
   - Si 5-20 leads : Afficher avec avertissement "Volume faible"
   - Si > 20 leads : Affichage normal

### Métriques Calculées

**Taux de Conversion :**
```
Conversion Rate = (converted / total) * 100
```

**Taux de Complétude Métadonnées :**
```
Metadata Completeness = (leads_with_utm_or_source / total) * 100
```

**Performance par Source :**
```
CTR Source = (leads_from_source / total_leads) * 100
```

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

## 📊 Requêtes SQL Recommandées

### 1. Vue d'Ensemble (KPIs)

```sql
SELECT 
  COUNT(*) as total_leads,
  COUNTIF(status = 'converted') as converted,
  COUNTIF(status = 'pending') as pending,
  COUNTIF(status = 'contacted') as contacted,
  COUNTIF(status = 'lost') as lost,
  SAFE_DIVIDE(COUNTIF(status = 'converted'), COUNT(*)) * 100 as conversion_rate,
  COUNTIF(utm_source IS NOT NULL OR source IS NOT NULL) as has_metadata,
  SAFE_DIVIDE(COUNTIF(utm_source IS NOT NULL OR source IS NOT NULL), COUNT(*)) * 100 as metadata_completeness
FROM `moverz-dashboard.analytics_core.leads`
WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
```

### 2. Répartition par Site

```sql
SELECT 
  site,
  COUNT(*) as count,
  COUNTIF(status = 'converted') as converted,
  SAFE_DIVIDE(COUNTIF(status = 'converted'), COUNT(*)) * 100 as conversion_rate
FROM `moverz-dashboard.analytics_core.leads`
WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY site
ORDER BY count DESC
```

### 3. Évolution Temporelle (par semaine si volume faible)

```sql
SELECT 
  DATE_TRUNC(DATE(created_at), WEEK) as week,
  COUNT(*) as count,
  COUNTIF(status = 'converted') as converted
FROM `moverz-dashboard.analytics_core.leads`
WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY week
ORDER BY week DESC
```

### 4. Top Sources

```sql
SELECT 
  COALESCE(utm_source, source, 'unknown') as source,
  COUNT(*) as count,
  COUNTIF(status = 'converted') as converted,
  SAFE_DIVIDE(COUNTIF(status = 'converted'), COUNT(*)) * 100 as conversion_rate
FROM `moverz-dashboard.analytics_core.leads`
WHERE DATE(created_at) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY source
ORDER BY count DESC
LIMIT 20
```

---

## 🚀 Plan d'Implémentation

### Phase 1: Préparation Données (URGENT)

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

## 📝 Notes Importantes

### Volume Faible = Regroupement Nécessaire

**Si volume < 50 leads :**
- Utiliser agrégations par semaine plutôt que par jour
- Périodes d'analyse : 30 jours minimum
- Afficher avertissement "Volume faible" dans le dashboard

### Métadonnées Critiques

**Pour analyses CTR :**
- UTM source/medium/campaign doivent être présents
- Source/medium doivent être capturés si pas d'UTM
- Vérifier qualité avant de construire le dashboard

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

---

## ✅ Prochaines Étapes

1. **Immédiat :** Vérifier PostgreSQL et exécuter ETL
2. **Court terme :** Relancer analyse pour voir les données réelles
3. **Moyen terme :** Construire le dashboard selon cette analyse
4. **Long terme :** Optimiser selon le volume réel de données

---

**Document créé le 2025-11-06. À mettre à jour après vérification PostgreSQL et exécution ETL.**

