# 📊 Changements : Historique des Erreurs 404

**Date** : 2025-01-XX  
**Fonctionnalité** : Enregistrement et visualisation de l'évolution des erreurs 404

---

## ✅ Ce qui a été fait

### 1. Migration BigQuery
- **Nouveau fichier** : `db/migrations/004_errors_404_history.sql`
- **Table créée** : `errors_404_history` (partitionnée par date, clusterisée)
- **Vues créées** : `v_errors_404_evolution`, `v_errors_404_latest_by_site`
- **Rétention** : 2 ans de données

### 2. Fonctions BigQuery (dashboard/lib/bigquery.ts)
- `insertError404History()` : Enregistre un scan
- `getError404Evolution()` : Récupère l'historique agrégé
- `getLastError404Scan()` : Récupère le dernier scan détaillé

### 3. API Routes
- **Nouveau** : `dashboard/app/api/404/history/route.ts`
  - GET `/api/404/history?days=30` : Retourne l'évolution
  
- **Modifié** : `dashboard/app/api/404/crawl/route.ts`
  - Enregistre automatiquement dans BigQuery après chaque crawl
  - Génére un UUID pour chaque scan

### 4. Composant UI
- **Nouveau** : `dashboard/components/Error404Evolution.tsx`
  - Graphique Recharts avec 3 lignes (moyenne, min, max)
  - Indicateur de tendance (↑↓)
  - Stats en bas
  
- **Modifié** : `dashboard/app/404/page.tsx`
  - Chargement auto de l'historique au montage
  - Affichage du composant en bas

### 5. Documentation
- **Fichier** : `dashboard/FEATURE-404-HISTORY.md`
- **Contenu** : Architecture complète, flux de données, utilisation

---

## 🚀 Comment tester en local

### Prérequis
1. Variables d'environnement configurées :
   ```bash
   cd dashboard
   # Créer .env.local si nécessaire
   echo "GCP_PROJECT_ID=moverz-dashboard" > .env.local
   echo "BQ_DATASET=analytics_core" >> .env.local
   # Ajouter GCP_SA_KEY_JSON avec credentials BigQuery
   ```

2. Migration BigQuery appliquée (optionnel pour test UI) :
   ```bash
   bq query --use_legacy_sql=false < db/migrations/004_errors_404_history.sql
   ```

### Lancer le dashboard
```bash
cd dashboard
npm run dev
# ou
./start-dev.sh  # (nouveau script créé)
```

### Ouvrir dans le navigateur
```
http://localhost:3000/404
```

### Ce que vous verrez
1. **Header** : Bouton "Analyser les 404"
2. **Message initial** : "Aucun crawl effectué" (si premier scan)
3. **Section Historique** : 
   - "Aucune donnée historique disponible" si pas de données
   - Graphique si données existantes

### Tester un scan
1. Cliquer sur "Analyser les 404"
2. Attendre ~30-60 secondes (crawl parallèle des 11 sites)
3. Résultats affichés :
   - Cards de résumé (Sites, Pages, Erreurs)
   - Table détaillée par site
   - Ligne TOTAL
4. **Automatiquement** : Les données sont enregistrées dans BigQuery
5. Recharger la page pour voir l'historique mis à jour

---

## 📋 Checklist de validation

- [ ] Le dashboard démarre sans erreur
- [ ] L'onglet 404 se charge correctement
- [ ] Le composant `Error404Evolution` s'affiche
- [ ] Message "Aucune donnée historique" visible si pas de données
- [ ] Bouton "Analyser les 404" fonctionne
- [ ] Après un scan : table de résultats + ligne TOTAL
- [ ] L'enregistrement BigQuery est appelé (vérifier logs console)
- [ ] Le graphique s'affiche après plusieurs scans

---

## 🔧 Dépannage

### Erreur "Cannot find module '@/components/Error404Evolution'"
```bash
cd dashboard
npm install
# Vérifier que le fichier existe : components/Error404Evolution.tsx
```

### Erreur BigQuery "Table not found"
- La migration n'a pas été appliquée
- Pour tester l'UI sans BigQuery : commenter la partie `insertError404History()` dans `crawl/route.ts`

### Port 3000 déjà utilisé
```bash
# Vérifier les processus
lsof -ti:3000 | xargs kill -9
# Relancer
npm run dev
```

---

## 📊 Format des données

### Exemple d'enregistrement
```json
{
  "id": "uuid-1234",
  "scan_date": "2025-01-XX 10:30:00",
  "total_sites": 11,
  "total_pages_checked": 1250,
  "total_errors_404": 47,
  "sites_results": [
    {"site": "site1.fr", "total_checked": 120, "errors_404": 5},
    {"site": "site2.fr", "total_checked": 115, "errors_404": 3}
  ],
  "crawl_duration_seconds": 42
}
```

### Format d'évolution (pour graphique)
```json
[
  {
    "date": "2025-01-15",
    "nb_scans": 2,
    "avg_pages_checked": 1200,
    "avg_errors_404": 45,
    "max_errors_404": 50,
    "min_errors_404": 40
  }
]
```

---

## 🎯 Prochaines étapes possibles

- [ ] Appliquer la migration BigQuery en production
- [ ] Configurer les credentials GCP dans l'environnement
- [ ] Lancer plusieurs scans pour alimenter l'historique
- [ ] Ajouter des alertes si augmentation > X%
- [ ] Export CSV de l'historique

---

**✅ Feature prête pour test en local !**

