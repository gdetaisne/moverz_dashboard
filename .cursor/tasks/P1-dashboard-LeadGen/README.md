# P1-dashboard-LeadGen - Dashboard Clics GSC

**Statut:** 🔄 À démarrer  
**Priorité:** P1  
**Créée:** 2025-11-06  
**Assignée:** Guillaume  
**Estimation:** 1-2 semaines

---

## 📋 Objectifs

Créer un dashboard complet pour visualiser et analyser les **clics GSC (Google Search Console)** des 11 sites du réseau Moverz mis en ligne le 1er octobre 2025.

**Fonctionnalités principales:**
1. Vue d'ensemble des clics (KPIs, tendances)
2. Analyse par site (vérifier que les 11 sites fonctionnent bien)
3. Analyse CTR (métadonnées propres et analysables)
4. Regroupement adapté au faible volume (par semaine si nécessaire)
5. Export des données

---

## 🎯 Critères de Succès

### Fonctionnalités
- ✅ Page `/leads` accessible dans la navigation
- ✅ API route `/api/leads` avec validation Zod
- ✅ Affichage liste des leads (table/cards)
- ✅ Filtres : site, date, source, status, campagne UTM
- ✅ KPIs : total leads, taux conversion, leads par site
- ✅ Graphiques : évolution temporelle, répartition par source
- ✅ Export CSV/JSON

### Technique
- ✅ Validation Zod sur route API
- ✅ Types TypeScript stricts
- ✅ Responsive (mobile-first)
- ✅ Performance acceptable (< 2s chargement)
- ✅ Tests automatisés

### Données
- ✅ Requêtes BigQuery optimisées
- ✅ Cache si nécessaire
- ✅ Gestion erreurs robuste

---

## 📊 Structure Prévue

### Pages
- `/leads` - Dashboard principal clics GSC
  - KPIs en haut (total clics, impressions, CTR, position moyenne)
  - Graphiques évolution temporelle (par jour ou semaine selon volume)
  - Analyse par site (vérifier les 11 sites)
  - Export

### API Routes
- `GET /api/leads` - Liste des clics GSC (avec filtres)
- `GET /api/leads/stats` - Statistiques agrégées (clics, impressions, CTR)
- `GET /api/leads/export` - Export CSV/JSON

### Composants
- `ClicksKPIs` - Cartes KPIs (clics, impressions, CTR, position)
- `ClicksChart` - Graphiques évolution (quotidien/hebdomadaire)
- `ClicksBySite` - Tableau répartition par site
- `ClicksFilters` - Filtres (site, date, période)

---

## 🔗 Références

- **ETL GSC:** `etl/gsc/fetch-simple.ts`
- **BigQuery Table:** `analytics_core.gsc_daily_aggregated`
- **Documentation API:** `dashboard/API-ROUTES.md`
- **Route API existante:** `dashboard/app/api/metrics/global/route.ts` (exemple)

---

## 📝 Notes

- Les clics GSC sont synchronisés depuis Google Search Console vers BigQuery via ETL
- Table BigQuery : `analytics_core.gsc_daily_aggregated`
- Champs disponibles : date, domain, clicks, impressions, ctr, position
- 11 sites attendus depuis le 1er octobre 2025

---

## 🔍 Analyse Initiale (2025-11-06)

**⚠️ Constat :** La table `gsc_daily_aggregated` n'existe peut-être pas encore dans BigQuery.

**Actions requises avant de démarrer :**
1. Vérifier que l'ETL GSC `etl/gsc/fetch-simple.ts` a été exécuté
2. Vérifier que les 11 sites sont bien trackés dans Google Search Console
3. Relancer l'analyse `analyse-clics-gsc.ts` pour voir les données réelles

**Voir `ANALYSE-CLICS-GSC.md` pour l'analyse complète et les recommandations.**

---

## 📊 Stratégie Dashboard (Volume Faible)

**Adaptation au faible volume :**
- Agrégations par semaine plutôt que par jour
- Périodes d'analyse : 30 jours minimum
- Avertissement "Volume faible" si < 50 leads
- Regroupement des données pour analyses significatives

---

**Tâche créée. Analyse effectuée. Actions requises avant développement.**

