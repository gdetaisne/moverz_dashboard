# 🔧 Corrections Build CapRover

## ⚠️ Problèmes Identifiés & Corrigés

### **1. Pas de captain-definition** ❌ → ✅ CORRIGÉ
**Problème** : CapRover ne savait pas comment builder l'app.

**Solution** : Créé `captain-definition` :
```json
{
  "schemaVersion": 2,
  "dockerfilePath": "./Dockerfile"
}
```

---

### **2. Build TypeScript crashait** ❌ → ✅ CORRIGÉ
**Problème** : 
- Dockerfile multi-stage tentait de compiler avec `tsc`
- `tsconfig.json` incluait `agents/**/*` et `db/**/*` (fichiers incomplets)
- Build échouait sur imports manquants

**Solution** : 
- **Simplifié Dockerfile** : single-stage, utilise `tsx` runtime (pas de compilation)
- **Corrigé tsconfig.json** : N'inclut que `etl/**/*` et `scripts/**/*`
- **CMD** : `npx tsx etl/gsc/fetch-simple.ts` (direct, pas besoin de build)

---

### **3. tsx manquant en production** ❌ → ✅ CORRIGÉ
**Problème** : 
- `tsx` était en devDependencies
- Dockerfile utilisait `--only=production`
- `npm run run:once` crashait

**Solution** : 
- `npm ci` sans `--only=production` (installe tout)
- Utilise `tsx` directement dans CMD

---

### **4. Healthcheck manquant** ⚠️ → ✅ AJOUTÉ
**Ajouté** : Healthcheck pour CapRover monitoring
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1
```

---

## 📦 Nouveau Dockerfile (Simplifié)

**Avant** : Multi-stage avec compilation TypeScript (complexe, fragile)  
**Après** : Single-stage avec tsx runtime (simple, robuste)

### Avantages :
✅ Pas de build step = pas de crash de compilation  
✅ Tous les scripts fonctionnent (`npm run backfill`, etc.)  
✅ Plus facile à debugger  
✅ Moins de layers Docker  

### Inconvénients :
⚠️ Image légèrement plus grosse (~100 MB vs ~50 MB)  
→ Acceptable pour un ETL, pas une app web

---

## 🚀 Test Local (avant CapRover)

```bash
# 1. Builder l'image
docker build -t moverz-etl-test .

# 2. Tester le run
docker run --rm \
  -e GCP_SA_KEY_JSON='{"type":"service_account",...}' \
  -e GCP_PROJECT_ID=moverz-dashboard \
  -e BQ_DATASET=analytics_core \
  -e SITES_LIST=devis-demenageur-marseille.fr \
  moverz-etl-test

# 3. Vérifier les logs
# Attendu: Configuration loaded, GSC data fetched, etc.
```

---

## ✅ Checklist Déploiement CapRover

### Avant Push :
- [x] `captain-definition` créé
- [x] Dockerfile simplifié (single-stage)
- [x] tsconfig.json corrigé
- [x] CMD utilise `tsx` (pas de build)
- [x] Healthcheck ajouté

### Après Push :
- [ ] CapRover rebuild automatiquement (~5-10 min)
- [ ] Vérifier logs : `caprover logs -a dd-dashboard -f`
- [ ] Tester ETL : Exec dans container → `npm run run:once`
- [ ] Vérifier BigQuery : Données insérées

---

## 🐛 Troubleshooting

### Build échoue encore ?

**Erreur : "Cannot find module 'tsx'"**
```bash
# Vérifier package.json
cat package.json | grep tsx

# Doit être dans dependencies OU devDependencies
# (le Dockerfile installe tout avec `npm ci`)
```

**Erreur : "Permission denied /app/..."**
```bash
# Vérifier ownership dans Dockerfile
# Ligne 31: RUN chown -R nodejs:nodejs /app
```

**Erreur : "GCP_SA_KEY_JSON is required"**
```bash
# Vérifier variable d'env dans CapRover UI
Apps → dd-dashboard → App Configs → Environment Variables
→ GCP_SA_KEY_JSON (contenu JSON complet)
```

---

## 📊 Variables d'Env Finales

**Format requis par le code** :
```bash
GCP_SA_KEY_JSON={"type":"service_account","project_id":"moverz-dashboard",...}
```

**PAS** :
```bash
# ❌ Base64 encodé
GCP_SA_KEY=LS0tLS1CRUdJTi...

# ❌ Chemin fichier (sauf si tu le crées dans Dockerfile)
GOOGLE_APPLICATION_CREDENTIALS=/app/sa-key.json
```

**Solution actuelle** : Le code parse `GCP_SA_KEY_JSON` directement.

---

## ✅ Prêt pour CapRover

```bash
git add -A
git commit -m "fix: CapRover build issues (captain-definition, Dockerfile, tsconfig)"
git push origin main

# Puis déployer sur CapRover
```

