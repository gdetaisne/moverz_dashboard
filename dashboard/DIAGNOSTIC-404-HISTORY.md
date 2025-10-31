# 🔍 DIAGNOSTIC : Problème Historique 404

**Date :** 2025-01-XX  
**Problème :** La section "Évolution des Erreurs 404" affiche "Aucune donnée historique disponible"

---

## 📊 ÉTAPES DE DIAGNOSTIC

### 1. Vérifier les logs du serveur

**Ouvrir la console du serveur** (terminal où `pnpm dev` tourne) et chercher :

```
[BigQuery getError404Evolution] Querying with days=30
[BigQuery getError404Evolution] Executing query on ...
[BigQuery getError404Evolution] Query returned X rows
[404/history] Mode: evolution, Loaded X evolution entries
```

**Si vous voyez :**
- `Query returned 0 rows` → **Problème : Pas de données dans BigQuery**
- `Query returned X rows` mais `Loaded 0 evolution entries` → **Problème : Conversion des données**
- Erreur BigQuery → **Problème : Permissions ou table inexistante**

---

### 2. Tester l'endpoint de diagnostic

**Appeler directement :**
```bash
curl http://localhost:3001/dashboard-api/404/test-history
```

**Ou dans le navigateur :**
```
http://localhost:3001/dashboard-api/404/test-history
```

**Vérifier dans la réponse :**
- `tests.tableExists: true` → Table existe
- `tests.totalRecords: X` → Nombre d'enregistrements
- `tests.evolutionQuery.success: true` → Query fonctionne
- `tests.evolutionQuery.count: X` → Nombre de résultats

**Si `totalRecords: 0` → Aucun scan n'a été enregistré dans BigQuery**

---

### 3. Vérifier les logs du frontend

**Ouvrir la console du navigateur** (F12) et chercher :

```
[404] History API response: {...}
[404] Setting historyData: X entries
```

**Structure attendue :**
```javascript
{
  success: true,
  hasData: true,
  hasEvolution: true,
  evolutionType: 'array',
  evolutionLength: X,  // > 0 si données
  evolutionSample: { date: "...", nb_scans: ..., ... }
}
```

**Si `evolutionLength: 0` → L'API retourne un tableau vide**

---

### 4. Vérifier que des scans ont été effectués

**Appeler :**
```bash
curl http://localhost:3001/dashboard-api/404/debug
```

**Vérifier :**
- `checks.totalRecords: X` → Doit être > 0
- `checks.recentScans: [...]` → Doit contenir des scans récents

**Si `totalRecords: 0` → Aucun scan n'a été sauvegardé**

---

### 5. Tester l'insertion dans BigQuery

**Lancer un nouveau scan** et vérifier les logs :

```
[404/crawl] Scan completed, inserting into BigQuery...
[BigQuery insertError404History] Inserting scan with scan_date: ...
[BigQuery insertError404History] Successfully inserted scan ID: ...
```

**Si erreur lors de l'insertion :**
- Vérifier les permissions BigQuery
- Vérifier que la table existe
- Vérifier le format de `scan_date` (doit être TIMESTAMP)

---

## 🔧 SOLUTIONS SELON LE PROBLÈME

### Problème 1 : Table vide (0 enregistrements)

**Symptôme :** `totalRecords: 0` dans `/api/404/debug`

**Cause :** Aucun scan n'a été sauvegardé ou la table n'a pas été créée

**Solution :**
1. Vérifier que la migration a été appliquée :
   ```bash
   # Vérifier la table existe dans BigQuery
   bq ls moverz-dashboard:analytics_core | grep errors_404_history
   ```

2. Lancer un nouveau scan depuis l'interface :
   - Cliquer sur "Lancer le crawl"
   - Vérifier qu'il se termine avec succès
   - Vérifier les logs d'insertion

3. Si la table n'existe pas, appliquer la migration :
   ```sql
   -- Voir db/migrations/004_errors_404_history.sql
   ```

---

### Problème 2 : Query retourne 0 rows malgré des données

**Symptôme :** `totalRecords > 0` mais `evolutionQuery.count: 0`

**Cause :** Tous les scans sont trop anciens (> 30 jours)

**Solution :**
1. Vérifier la date des scans récents :
   ```bash
   curl http://localhost:3001/dashboard-api/404/debug | jq '.diagnostics.checks.recentScans'
   ```

2. Augmenter la fenêtre de recherche :
   ```typescript
   // Dans loadHistory(), changer days=30 à days=365
   const response = await fetch('/dashboard-api/404/history?days=365&mode=evolution')
   ```

3. Ou utiliser le mode 'last' au lieu de 'evolution' :
   ```typescript
   const response = await fetch('/dashboard-api/404/history?mode=last&count=20')
   ```

---

### Problème 3 : Erreur BigQuery (permissions/table)

**Symptôme :** Erreur dans les logs : `Table not found` ou `Permission denied`

**Cause :** Table inexistante ou permissions insuffisantes

**Solution :**
1. Vérifier les variables d'environnement :
   ```bash
   echo $GCP_PROJECT_ID
   echo $BQ_DATASET
   echo $GOOGLE_APPLICATION_CREDENTIALS
   ```

2. Vérifier que le compte de service a les permissions :
   - `BigQuery Data Editor`
   - `BigQuery Job User`

3. Appliquer la migration si la table n'existe pas

---

### Problème 4 : Conversion des données échoue

**Symptôme :** Query retourne rows mais `evolution` est vide ou mal formaté

**Cause :** Problème de mapping JavaScript (BigNumber, dates, etc.)

**Solution :**
1. Vérifier les logs :
   ```
   [BigQuery getError404Evolution] Converted X results
   [404/history] Evolution type: object not array
   ```

2. Si `Evolution type: object` → Le mapping échoue, vérifier le format des dates

3. Utiliser l'endpoint de test pour voir les données brutes :
   ```bash
   curl http://localhost:3001/dashboard-api/404/test-history | jq '.results.tests.evolutionQuery.allRows'
   ```

---

### Problème 5 : Frontend ne reçoit pas les données

**Symptôme :** API retourne données mais frontend affiche tableau vide

**Cause :** Problème de parsing JSON ou structure de réponse différente

**Solution :**
1. Vérifier les logs du navigateur :
   ```
   [404] History API response: { success: true, hasEvolution: false }
   ```

2. Si `hasEvolution: false` → La structure de réponse est différente

3. Vérifier que l'URL de l'API est correcte :
   - Dev : `/dashboard-api/404/history`
   - Production : `/api/404/history` (peut varier selon config)

---

## 📝 CHECKLIST DE VÉRIFICATION RAPIDE

- [ ] La table `errors_404_history` existe dans BigQuery
- [ ] La table contient au moins 1 enregistrement (`totalRecords > 0`)
- [ ] Les scans récents sont dans les 30 derniers jours
- [ ] L'API `/api/404/test-history` retourne `evolutionQuery.success: true`
- [ ] L'API `/api/404/history?mode=evolution&days=30` retourne `data.evolution.length > 0`
- [ ] Les logs du serveur montrent `Query returned X rows` avec X > 0
- [ ] La console du navigateur montre `evolutionLength: X` avec X > 0
- [ ] Le composant `Error404Evolution` reçoit `data.length > 0`

---

## 🚀 COMMANDE DE TEST RAPIDE

**Exécuter cette commande pour un diagnostic complet :**

```bash
# 1. Vérifier l'état de la table
curl -s http://localhost:3001/dashboard-api/404/debug | jq '.diagnostics.checks'

# 2. Tester la requête d'évolution
curl -s http://localhost:3001/dashboard-api/404/test-history | jq '.results.tests.evolutionQuery'

# 3. Tester l'API complète
curl -s http://localhost:3001/dashboard-api/404/history?days=30&mode=evolution | jq '.data.evolution | length'
```

**Si toutes les commandes retournent `0` ou `null` → Problème de données ou de configuration BigQuery**

---

## 💡 SOLUTION RAPIDE (TEST)

**Forcer un test avec mode 'last' (non agrégé) :**

Dans `dashboard/app/404/page.tsx`, ligne 145, changer :

```typescript
// Avant
const response = await fetch('/dashboard-api/404/history?days=30&mode=evolution')

// Après
const response = await fetch('/dashboard-api/404/history?mode=last&count=20')
```

**Si cela fonctionne → Le problème est dans la requête d'agrégation quotidienne (`getError404Evolution`)**

---

## 📞 PROCHAINES ÉTAPES

1. **Exécuter les tests ci-dessus**
2. **Copier les logs complets** (serveur + navigateur)
3. **Copier la réponse de `/api/404/test-history`**
4. **Identifier le point de blocage** selon les étapes ci-dessus

Une fois le problème identifié, corriger selon la section "SOLUTIONS" correspondante.

