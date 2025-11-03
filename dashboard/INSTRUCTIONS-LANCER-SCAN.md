# 🚀 Instructions pour lancer un scan et voir l'historique

## ✅ État actuel (vérifié)

- ✅ Table BigQuery existe : `moverz-dashboard.analytics_core.errors_404_history`
- ✅ Configuration `.env.local` correcte avec JSON complet
- ✅ Serveur accessible sur `http://localhost:3000`
- ⏳ **Table vide (0 enregistrements)** - Normal, besoin de lancer un scan

---

## 🎯 Actions à faire MAINTENANT

### Étape 1 : Ouvrir la page 404

```
http://localhost:3000/404
```

### Étape 2 : Lancer un scan

1. Cliquer sur le bouton **"Analyser les 404"**
2. Attendre la fin du crawl (~30-60 secondes)
3. Observer la progression dans l'interface

### Étape 3 : Vérifier les logs du serveur

Dans le terminal où `npm run dev` tourne, vous devriez voir :

```
[404/crawl] BigQuery config: { projectId: 'moverz-dashboard', dataset: 'analytics_core', hasCredentials: true }
💾 Enregistrement dans BigQuery...
✅ Historique BigQuery enregistré (ID: xxx-xxx-xxx)
```

**Si vous voyez `hasCredentials: false`** → Le serveur n'a pas été redémarré. Arrêter et relancer `npm run dev`.

### Étape 4 : Vérifier que les données sont enregistrées

```bash
# Dans un nouveau terminal
cd /Users/guillaumestehelin/moverz_dashboard-2
npx tsx scripts/check-404-history-table.ts
```

Vous devriez voir :
```
4️⃣ Nombre d'enregistrements...
   Total: 1 enregistrements  # ou plus
```

### Étape 5 : Voir l'historique dans l'UI

1. Recharger la page `/404` (F5)
2. Scroller vers le bas
3. Le composant **"Évolution des Erreurs 404"** devrait maintenant afficher :
   - Un graphique avec la courbe d'évolution
   - Les statistiques (scans totaux, moyennes, etc.)

---

## 🐛 Si ça ne fonctionne pas

### Problème : "hasCredentials: false" dans les logs

**Solution :**
1. Vérifier que `.env.local` existe dans `dashboard/`
2. Redémarrer le serveur : Arrêter (Ctrl+C) puis `npm run dev`

### Problème : Erreur BigQuery "Permission denied"

**Solution :** Vérifier que le service account `etl-runner@moverz-dashboard.iam.gserviceaccount.com` a les permissions dans Google Cloud Console.

### Problème : Erreur BigQuery "Table not found"

**Solution :** La table existe (on a vérifié), mais si ça arrive :
```bash
bq query --use_legacy_sql=false < db/migrations/004_errors_404_history.sql
```

### Problème : Le graphique ne s'affiche toujours pas

**Vérifier :**
1. Ouvrir la console du navigateur (F12)
2. Chercher `[404] History API response`
3. Vérifier que `evolutionLength` est > 0

Si `evolutionLength: 0`, c'est que :
- Soit aucun scan n'a été enregistré
- Soit la requête BigQuery échoue (vérifier les logs serveur)

---

## 📝 Checklist rapide

- [ ] Serveur Next.js redémarré après modification de `.env.local`
- [ ] Scan lancé depuis `/404`
- [ ] Logs montrent `✅ Historique BigQuery enregistré`
- [ ] Script de vérification montre > 0 enregistrements
- [ ] Graphique s'affiche dans l'UI

---

**🚀 Prêt ? Allez sur http://localhost:3000/404 et lancez un scan !**

