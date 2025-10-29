# 📊 Feature : Historique des Erreurs 404

## 🎯 Objectif
Enregistrer et visualiser l'évolution temporelle du nombre d'erreurs 404 détectées lors des scans.

## ✅ Implémentation

### 1. Migration BigQuery
**Fichier** : `db/migrations/004_errors_404_history.sql`

**Créé** :
- Table `errors_404_history` : Stocke tous les scans avec résultats détaillés
  - Partitionnée par date
  - Clusterisée par scan_date pour performance
  - Rétention : 2 ans
  
- Vue `v_errors_404_evolution` : Agrégation quotidienne
  - Nombre de scans par jour
  - Moyennes (pages vérifiées, erreurs 404, durée)
  - Min/Max erreurs 404
  
- Vue `v_errors_404_latest_by_site` : Dernier scan par site
  - Liste des sites avec leurs erreurs
  - Taux d'erreur calculé

### 2. API BigQuery
**Fichier** : `dashboard/lib/bigquery.ts`

**Ajouté** :
- `insertError404History(entry)` : Enregistre un scan dans BigQuery
- `getError404Evolution(days)` : Récupère l'historique agrégé
- `getLastError404Scan()` : Récupère le dernier scan détaillé

**Types** :
- `Error404HistoryEntry` : Structure d'un enregistrement
- `Error404Evolution` : Données agrégées pour le graphique

### 3. API Routes
**Fichier** : `dashboard/app/api/404/history/route.ts` (nouveau)

- `GET /api/404/history?days=30` : Récupère l'évolution sur N jours
  - Retourne : evolution (agrégée), lastScan (détaillé)

**Modifié** : `dashboard/app/api/404/crawl/route.ts`

- Enregistre automatiquement le résultat dans BigQuery après chaque crawl
- UUID généré pour l'ID unique
- Gestion d'erreur : ne fait pas échouer le crawl si l'enregistrement échoue

### 4. Composant UI
**Fichier** : `dashboard/components/Error404Evolution.tsx` (nouveau)

**Fonctionnalités** :
- Graphique temporel avec Recharts
  - Ligne moyenne des erreurs 404
  - Lignes min/max (pointillés)
  
- Indicateur de tendance
  - ↑ Hausse : rouge avec TrendingUp
  - ↓ Baisse : vert avec TrendingDown
  - = Stable : gris avec Minus
  
- Stats additionnelles
  - Scans totaux
  - Erreurs moyennes
  - Pages vérifiées (moyenne)
  - Durée moyenne (secondes)

**Fichier** : `dashboard/app/404/page.tsx` (modifié)

**Ajouté** :
- State `historyData` et `loadingHistory`
- useEffect pour charger l'historique au montage
- Fonction `loadHistory()` pour récupérer les données
- Composant `<Error404Evolution>` affiché en bas de page

## 📊 Flux de Données

```
1. Utilisateur clique "Analyser les 404"
   ↓
2. POST /api/404/crawl
   - Crawl récursif des 11 sites
   - Serveur envoie événements SSE (progressif)
   ↓
3. Fin du crawl
   - Résultats calculés (total_sites, total_pages, total_errors)
   - Enregistrement dans BigQuery via insertError404History()
   ↓
4. Composant Error404Evolution
   - Chargement au mount via GET /api/404/history
   - Requête BigQuery : getError404Evolution(30 jours)
   ↓
5. Affichage graphique
   - Évolution temporelle des erreurs 404
   - Stats et tendance
```

## 🔧 Configuration Requise

### Variables d'environnement
```bash
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GCP_SA_KEY_JSON={...} # Service Account avec permissions BigQuery
```

### Migration BigQuery
```bash
# Appliquer la migration
bq query --use_legacy_sql=false < db/migrations/004_errors_404_history.sql
```

## 📈 Utilisation

### Démarrer un scan
1. Ouvrir l'onglet "404" dans le dashboard
2. Cliquer sur "Analyser les 404"
3. Attendre ~30-60 secondes (crawl parallèle)
4. Les résultats sont **automatiquement enregistrés** dans BigQuery

### Visualiser l'historique
1. L'onglet charge automatiquement l'historique des 30 derniers jours
2. Le graphique affiche :
   - Évolution des erreurs (ligne orange)
   - Min/Max (lignes pointillées vert/rouge)
   - Tendance (↑↓) en haut à droite
   - Stats en bas (scans totaux, moyennes, etc.)

## 🎨 Interface

### Sections de la page 404
1. **Header** : Bouton "Analyser les 404" + dernier scan
2. **Summary Cards** : Sites, Pages, Erreurs (après scan)
3. **Résultats Table** : Détail par site + ligne TOTAL
4. **📊 Historique** : Graphique d'évolution (nouveau)

## 🐛 Gestion d'Erreurs

### BigQuery indisponible
- Le crawl continue normalement
- Les résultats s'affichent dans l'UI
- Log : `⚠️ Erreur lors de l'enregistrement BigQuery`
- L'enregistrement sera perdu (non bloquant)

### Pas de données historiques
- Message : "Aucune donnée historique disponible"
- Icône AlertTriangle
- Instruction : "Lancez un scan pour commencer"

## 🔍 Données Stockées

### Structure d'un enregistrement
```json
{
  "id": "uuid-v4",
  "scan_date": "2025-01-XX 10:30:00",
  "total_sites": 11,
  "total_pages_checked": 1250,
  "total_errors_404": 47,
  "sites_results": [
    {
      "site": "devis-demenageur-marseille.fr",
      "total_checked": 120,
      "errors_404": 5
    },
    ...
  ],
  "crawl_duration_seconds": 42,
  "created_at": "2025-01-XX 10:30:15"
}
```

## 🎯 Avantages

1. **Tracking automatique** : Pas d'action manuelle, enregistré à chaque scan
2. **Historique long** : 2 ans de rétention (partition BigQuery)
3. **Performance** : Clustering optimisé pour requêtes temporelles
4. **Visualisation claire** : Graphique avec tendance et stats
5. **Non-bloquant** : L'enregistrement ne fait pas échouer le crawl

## 🚀 Prochaines Améliorations Possibles

- [ ] Export CSV de l'historique
- [ ] Alertes automatiques si augmentation > X%
- [ ] Comparaison période (semaine/mois précédent)
- [ ] Détail par site dans le graphique (choix site)
- [ ] Prévision tendance (ML simple)

