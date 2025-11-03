# ✅ Vérification BigQuery - Résultat

**Date :** 2025-01-XX

## 📊 État actuel

✅ **La table `errors_404_history` existe dans BigQuery**
- Dataset : `moverz-dashboard.analytics_core`
- Table : `errors_404_history`
- Partition : Oui (par `scan_date`)
- **Problème :** 0 enregistrements (table vide)

## 🔧 Pour que ça fonctionne

### 1. Vérifier la configuration `.env.local`

Le fichier `dashboard/.env.local` doit contenir :

```bash
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GCP_SA_KEY_JSON={"type":"service_account",...} # JSON complet
```

**Vérification :**
```bash
cd dashboard
grep GCP_SA_KEY_JSON .env.local | head -c 100
# Doit afficher : GCP_SA_KEY_JSON={"type":"service_account"...
```

### 2. Redémarrer le serveur Next.js

**IMPORTANT :** Next.js charge `.env.local` au démarrage. Après modification, il faut redémarrer.

```bash
cd dashboard
# Arrêter le serveur (Ctrl+C)
npm run dev
```

### 3. Lancer un scan depuis l'interface

1. Ouvrir : `http://localhost:3000/404`
2. Cliquer sur "Analyser les 404"
3. Attendre la fin du crawl (~30-60 secondes)
4. Vérifier les logs du serveur :

```
[404/crawl] BigQuery config: { projectId: 'moverz-dashboard', dataset: 'analytics_core', hasCredentials: true }
✅ Historique BigQuery enregistré (ID: xxx-xxx-xxx)
```

### 4. Vérifier que les données sont enregistrées

```bash
# Re-exécuter le script de vérification
npx tsx scripts/check-404-history-table.ts
```

Vous devriez voir :
```
4️⃣ Nombre d'enregistrements...
   Total: 1 enregistrements  # ou plus si plusieurs scans
```

### 5. L'historique devrait maintenant s'afficher

Recharger la page `/404` - le composant `Error404Evolution` devrait maintenant afficher le graphique.

---

## 🐛 Si ça ne fonctionne toujours pas

### Erreur : "hasCredentials: false"

**Cause :** Le `.env.local` n'est pas chargé ou le JSON est mal formaté.

**Solution :**
1. Vérifier que `.env.local` est bien dans `dashboard/` (pas à la racine)
2. Vérifier que le JSON est sur une seule ligne
3. Redémarrer le serveur

### Erreur : "Permission denied" ou "403"

**Cause :** Le service account n'a pas les permissions.

**Solution :** Vérifier dans Google Cloud Console que le compte `etl-runner@moverz-dashboard.iam.gserviceaccount.com` a :
- `BigQuery Data Editor`
- `BigQuery Job User`

### Erreur : "Table not found"

**Cause :** La table n'existe pas (mais on vient de vérifier qu'elle existe).

**Solution :** Réappliquer la migration :
```bash
bq query --use_legacy_sql=false < db/migrations/004_errors_404_history.sql
```

---

## 📝 Checklist finale

- [ ] `.env.local` existe dans `dashboard/`
- [ ] `.env.local` contient `GCP_SA_KEY_JSON` avec le JSON complet
- [ ] Le serveur Next.js a été redémarré après modification de `.env.local`
- [ ] Un scan a été lancé depuis `/404`
- [ ] Les logs montrent `✅ Historique BigQuery enregistré`
- [ ] `scripts/check-404-history-table.ts` montre > 0 enregistrements
- [ ] L'historique s'affiche dans l'UI

---

**État actuel :** ✅ Table existe | ❌ 0 données | ⏳ Besoin de lancer un scan

