# 🚨 Feature : Alertes Search Console dans le Dashboard

**Date** : 2025-01-XX  
**Statut** : ✅ Implémenté

---

## 🎯 Fonctionnalité

Intégration des alertes et problèmes d'indexation de Google Search Console directement dans le dashboard Moverz Analytics.

---

## 📦 Fichiers créés/modifiés

### 1. Migration BigQuery
**Fichier** : `db/migrations/008_gsc_issues.sql`
- Table `gsc_issues` pour stocker les problèmes d'indexation
- Vues `v_gsc_issues_active` et `v_gsc_issues_stats`
- Partitionnement par date (2 ans de rétention)

### 2. ETL Issues
**Fichier** : `etl/gsc/fetch-issues.ts`
- Récupère les top pages via GSC API
- Inspecte chaque URL via API URL Inspection
- Détecte les problèmes d'indexation (FAIL, PARTIAL, EXCLUDED)
- Stocke dans BigQuery avec déduplication

### 3. API Route
**Fichier** : `dashboard/app/api/gsc/issues/route.ts`
- Endpoint GET `/dashboard-api/gsc/issues`
- Filtres : domain, severity, status, days
- Retourne issues + statistiques

### 4. Page Dashboard
**Fichier** : `dashboard/app/gsc-issues/page.tsx`
- Liste des alertes avec filtres
- Stats par sévérité et type
- Modal de détails avec pages affectées
- Filtres : domaine, sévérité, statut

### 5. Navigation
**Fichier** : `dashboard/components/Navigation.tsx`
- Ajout du lien "Alertes GSC" dans la navigation

### 6. Scheduler
**Fichier** : `etl/scheduler.ts`
- Job quotidien à 09:30 (après GSC principal)
- Script npm : `npm run etl:gsc-issues`

---

## 🚀 Utilisation

### 1. Appliquer la migration BigQuery

```bash
# Via bq CLI
bq query --use_legacy_sql=false < db/migrations/008_gsc_issues.sql

# Ou via BigQuery Console
# Copier le contenu du fichier SQL dans Query Editor
```

### 2. Lancer l'ETL manuellement

```bash
npm run etl:gsc-issues
```

**Attendu** :
- Inspection des top 50 pages de chaque site
- Détection des problèmes d'indexation
- Insertion dans BigQuery

### 3. Vérifier les données

```sql
-- Issues actives
SELECT * FROM `moverz-dashboard.analytics_core.v_gsc_issues_active`
ORDER BY detected_at DESC
LIMIT 10

-- Stats par domaine
SELECT * FROM `moverz-dashboard.analytics_core.v_gsc_issues_stats`
```

### 4. Accéder au dashboard

```
https://dd-dashboard.gslv.cloud/gsc-issues
```

---

## 📊 Types de problèmes détectés

| Type | Sévérité | Description |
|------|----------|-------------|
| **Indexing FAIL** | `error` | URL non indexée (jamais crawlée ou exclue) |
| **EXCLUDED** | `warning` | URL exclue par une règle (robots.txt, noindex) |
| **PARTIAL** | `warning` | Indexation partielle (certains éléments manquants) |

---

## ⚙️ Configuration

### Variables d'environnement

```bash
# Déjà présentes
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GCP_SA_KEY_JSON={...}
SITES_LIST=devis-demenageur-marseille.fr,...

# Optionnelle
MAX_URLS_PER_SITE=50  # Nombre de pages inspectées par site (défaut: 50)
```

---

## 🔄 Planning automatique

Le scheduler lance automatiquement l'ETL tous les jours à **09:30** (après le job GSC principal à 09:00).

---

## 💡 Limites & Optimisations

### Limitations actuelles

1. **API URL Inspection** : Rate limiting (inspecte par batch de 5 avec pause de 2s)
2. **Top 50 pages** : Limite d'inspection pour éviter timeout
3. **Pas d'accès direct aux alertes GSC** : L'API ne fournit pas les notifications email directement

### Optimisations possibles

1. **Augmenter le nombre de pages inspectées** : Via `MAX_URLS_PER_SITE`
2. **Inspection sélective** : Cibler uniquement les pages à fort trafic
3. **Cache intelligent** : Éviter de ré-inspecter les URLs récentes

---

## 📈 Exemple de données

```json
{
  "id": "marseille-/blog/article-20250101",
  "issue_date": "2025-01-15",
  "domain": "devis-demenageur-marseille.fr",
  "issue_type": "indexing",
  "severity": "error",
  "status": "open",
  "title": "URL non indexée: /blog/article",
  "description": "Dernier crawl: 2025-01-10. URL jamais crawlée",
  "affected_pages_count": 1,
  "affected_urls": ["/blog/article"],
  "detected_at": "2025-01-15T09:30:00Z",
  "source": "url_inspection"
}
```

---

## 🐛 Troubleshooting

### Erreur "Rate limited"

**Cause** : Trop de requêtes à l'API URL Inspection

**Solution** : Réduire `MAX_URLS_PER_SITE` ou augmenter les pauses entre batches

### Pas d'issues détectées

**Vérifier** :
1. Les pages ont-elles du trafic GSC ? (`getTopPages` retourne des résultats ?)
2. Les URLs sont-elles accessibles ? (pas de 404)
3. Les permissions Service Account sont-elles correctes ?

### Issues en doublon

**Cause** : Relancer l'ETL le même jour

**Solution** : Déjà géré avec déduplication sur `(domain, issue_date, id)`

---

## ✅ Checklist mise en production

- [ ] Migration BigQuery appliquée (`008_gsc_issues.sql`)
- [ ] Test manuel réussi (`npm run etl:gsc-issues`)
- [ ] Vérifier données dans BigQuery (table `gsc_issues`)
- [ ] Tester l'API route (`/dashboard-api/gsc/issues`)
- [ ] Vérifier la page dashboard (`/gsc-issues`)
- [ ] Scheduler configuré (09:30 quotidien)
- [ ] Variables d'env OK (GCP credentials)

---

## 📚 Documentation

- [Google Search Console API - URL Inspection](https://developers.google.com/webmaster-tools/v1/urlInspection/index/inspect)
- [Migration SQL](../db/migrations/008_gsc_issues.sql)
- [ETL Code](../etl/gsc/fetch-issues.ts)

---

**Dernière mise à jour** : 2025-01-XX  
**Version** : 1.0.0

