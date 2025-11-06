# 🧪 Test en Local - ETL GSC Issues

**Date :** 2025-11-06  
**Objectif :** Tester la nouvelle fonctionnalité de vérification automatique des alertes résolues

---

## ✅ Prérequis Vérifiés

- ✅ `.env.local` existe dans `dashboard/`
- ✅ Fichier clé GCP trouvé : `/Users/guillaumestehelin/Keys/moverz-analytics-service-account.json`
- ✅ Dépendances installées (`node_modules`)

---

## 🚀 Lancer le Dashboard en Local

### Étape 1 : Vérifier les variables d'environnement

```bash
cd /Users/guillaumestehelin/moverz_dashboard-2/dashboard

# Vérifier que ces variables existent :
grep -E "^GCP_PROJECT_ID|^BQ_DATASET|^GCP_SA_KEY_JSON|^SITES_LIST" .env.local
```

**Variables requises :**
- `GCP_PROJECT_ID=moverz-dashboard`
- `BQ_DATASET=analytics_core`
- `GCP_SA_KEY_JSON={"type":"service_account",...}` (JSON complet sur une ligne)
- `SITES_LIST=devis-demenageur-marseille.fr,...`

### Étape 2 : Lancer le serveur

```bash
cd /Users/guillaumestehelin/moverz_dashboard-2/dashboard
npm run dev
```

**Attendu :**
```
  ▲ Next.js 14.2.33
  - Local:        http://localhost:3000
  ✓ Ready in 75ms
```

### Étape 3 : Ouvrir le dashboard

```
http://localhost:3000
```

---

## 🧪 Tester la Fonctionnalité ETL GSC Issues

### Test 1 : Accéder à la page GSC Issues

1. Naviguer vers : `http://localhost:3000/gsc-issues`
2. Vérifier que la page se charge
3. Observer les alertes actuelles (normalement celles du 03/11)

### Test 2 : Lancer la vérification manuelle

1. Cliquer sur le bouton **"Vérifier les alertes GSC"** (bouton vert)
2. Attendre la fin de l'exécution (peut prendre 3-5 minutes)
3. Observer le message de résultat

**Ce qui devrait se passer :**
- Vérification de toutes les alertes "open" des 90 derniers jours
- Pour chaque alerte, vérification dans GSC si elle existe encore
- Marquage automatique comme "resolved" si verdict = PASS
- Détection de nouvelles alertes
- Rechargement automatique des alertes après 3 secondes

### Test 3 : Vérifier les résultats

1. Après l'ETL, les alertes devraient se mettre à jour
2. Certaines alertes du 03/11 devraient être marquées "resolved" si elles sont corrigées
3. De nouvelles alertes peuvent apparaître si détectées

---

## 🔍 Vérification dans les Logs

Dans le terminal où `npm run dev` tourne, tu devrais voir :

```
[etl/run-issues] Lancement manuel de l'ETL GSC Issues demandé
[etl/run-issues] Exécution du script ETL
[etl/run-issues] ETL terminé avec succès
```

**Logs du script ETL (dans stdout) :**
```
Verifying existing open issues
Progress verification: { checked: 5, resolved: 2, total: 9 }
Issues marked as resolved: { count: 2 }
```

---

## 🐛 Troubleshooting

### Problème : "GCP_SA_KEY_JSON is required"

**Solution :**
Vérifier que `GCP_SA_KEY_JSON` est bien défini dans `.env.local` avec le JSON complet :

```bash
# Vérifier le contenu (première ligne seulement)
head -1 dashboard/.env.local | grep GCP_SA_KEY_JSON | wc -c
# Devrait être > 500 caractères
```

Si manquant, ajouter :
```bash
cd dashboard
echo "GCP_SA_KEY_JSON=$(cat /Users/guillaumestehelin/Keys/moverz-analytics-service-account.json | jq -c .)" >> .env.local
```

### Problème : "SITES_LIST is required"

**Solution :**
Vérifier que `SITES_LIST` est défini dans `.env.local`. Si manquant :

```bash
cd dashboard
echo 'SITES_LIST=devis-demenageur-marseille.fr,devis-demenageur-strasbourg.fr,devis-demenageur-lille.fr,devis-demenageur-rennes.fr,devis-demenageur-rouen.fr,devis-demenageur-nice.fr,devis-demenageur-nantes.fr,devis-demenageur-toulousain.fr,devis-demenageur-lyon.fr,bordeaux-demenageur.fr,devis-demenageur-montpellier.fr' >> .env.local
```

### Problème : Erreur "Cannot find module"

**Solution :**
Installer les dépendances :

```bash
cd /Users/guillaumestehelin/moverz_dashboard-2
npm install
cd dashboard
npm install
```

### Problème : Timeout (5 minutes)

**Normal :** L'inspection URL peut prendre du temps. Si timeout, réduire le nombre de sites en mode test :

```bash
# Dans dashboard/.env.local
TEST_MODE=true
MAX_URLS_PER_SITE=5
```

---

## 📊 Résultats Attendus

### Si tout fonctionne :

1. ✅ Bouton "Vérifier les alertes GSC" visible et fonctionnel
2. ✅ ETL se lance sans erreur
3. ✅ Alertes résolues automatiquement marquées "resolved"
4. ✅ Nouvelles alertes détectées si présentes
5. ✅ Dates à jour (06/11 au lieu de 03/11)

### Statistiques attendues :

- Alertes vérifiées : ~9 (celles du 03/11)
- Alertes résolues : 0-9 (selon si corrigées dans GSC)
- Nouvelles alertes : 0-X (selon les nouveaux problèmes)

---

## ⏱️ Durée Estimée

- **Lancement serveur :** 5-10 secondes
- **Chargement page GSC Issues :** 1-2 secondes
- **Exécution ETL :** 3-5 minutes (vérification de toutes les alertes + détection nouvelles)

---

**✅ Prêt pour les tests !**

