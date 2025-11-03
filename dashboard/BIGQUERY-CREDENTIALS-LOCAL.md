# 🔑 Configuration BigQuery - Local

## 📍 Emplacement de la clé de service

**Fichier de clé (ne pas supprimer) :**
```
/Users/guillaumestehelin/Keys/moverz-analytics-service-account.json
```

Ce fichier contient les credentials du service account Google Cloud Platform pour accéder à BigQuery.

---

## ⚙️ Configuration pour le dashboard

### Option 1 : Utiliser le fichier directement (recommandé)

Le code dans `dashboard/lib/bigquery.ts` lit `GCP_SA_KEY_JSON` comme variable d'environnement.

Pour utiliser le fichier, créez `dashboard/.env.local` :

```bash
cd dashboard
cat > .env.local << 'EOF'
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GCP_SA_KEY_JSON=$(cat /Users/guillaumestehelin/Keys/moverz-analytics-service-account.json)
EOF
```

**Note :** Cette syntaxe `$(cat ...)` ne fonctionnera pas dans `.env.local` car Next.js ne supporte pas les commandes shell.

### Option 2 : Copier le contenu du fichier

```bash
# 1. Lire le contenu du fichier (sur une seule ligne)
cat /Users/guillaumestehelin/Keys/moverz-analytics-service-account.json | jq -c .

# 2. Créer dashboard/.env.local avec le JSON collé
cd dashboard
cat > .env.local << 'EOF'
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GCP_SA_KEY_JSON={"type":"service_account",...} # Coller le JSON complet ici
EOF
```

### Option 3 : Utiliser GOOGLE_APPLICATION_CREDENTIALS (alternative)

Si vous préférez utiliser le fichier directement (comme le fait l'ETL), il faudrait modifier `dashboard/lib/bigquery.ts` pour supporter `GOOGLE_APPLICATION_CREDENTIALS` :

```typescript
// dashboard/lib/bigquery.ts
export const bigquery = new BigQuery({
  projectId,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined,
  credentials: process.env.GOOGLE_SA_KEY_JSON ? JSON.parse(process.env.GOOGLE_SA_KEY_JSON) : undefined,
})
```

Puis dans `dashboard/.env.local` :
```bash
GOOGLE_APPLICATION_CREDENTIALS=/Users/guillaumestehelin/Keys/moverz-analytics-service-account.json
```

---

## ✅ Vérification

Après configuration, redémarrer le serveur et vérifier :

```bash
# Dans les logs du serveur lors d'un scan
[404/crawl] BigQuery config: { projectId: 'moverz-dashboard', dataset: 'analytics_core', hasCredentials: true }
```

Ou tester :
```bash
curl http://localhost:3000/dashboard-api/404/debug
```

---

**Date de création :** 2025-01-XX  
**Emplacement clé :** `/Users/guillaumestehelin/Keys/moverz-analytics-service-account.json`

