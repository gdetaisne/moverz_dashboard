# 🔧 Fix URL Bordeaux - www.bordeaux-demenageur.fr

**Date** : 30 Octobre 2025  
**Problème** : Le site Bordeaux n'affichait qu'1 page vérifiée au lieu de ~150 pages

## 🐛 Problème Identifié

Le site **Bordeaux** utilise le sous-domaine `www` : `https://www.bordeaux-demenageur.fr/`

Mais la configuration utilisait `bordeaux-demenageur.fr` (sans www), ce qui provoquait :
- ❌ Scan 404 ne détectait qu'1 page
- ❌ Crawler ne trouvait pas les pages internes
- ❌ Taux d'erreur calculé incorrectement

## ✅ Solution Appliquée

Mise à jour de **tous les fichiers** pour utiliser `www.bordeaux-demenageur.fr` :

### Fichiers Modifiés

#### 1. Dashboard API Routes
- ✅ `dashboard/app/api/404/scan/route.ts`
- ✅ `dashboard/app/api/404/crawl/route.ts`
- ✅ `dashboard/app/api/chat/route.ts`

#### 2. Dashboard UI & Utils
- ✅ `dashboard/app/page.tsx` (sitesWithLinking)
- ✅ `dashboard/lib/utils.ts` (CITIES mapping)

#### 3. ETL Configuration
- ✅ `etl/shared/config.ts` (DEFAULT_SITES)
- ✅ `etl/shared/types.ts` (DOMAIN_TO_CITY + SITES fixtures)

#### 4. Scripts
- ✅ `scripts/setup/init-ga4.sh` (DOMAINS array + siteMap)

### Changements Effectués

```diff
- 'bordeaux-demenageur.fr'
+ 'www.bordeaux-demenageur.fr'
```

### Rétrocompatibilité

Dans `etl/shared/types.ts`, les deux URLs sont supportées :

```typescript
export const DOMAIN_TO_CITY: Record<string, City> = {
  'www.bordeaux-demenageur.fr': 'bordeaux',
  'bordeaux-demenageur.fr': 'bordeaux', // Rétrocompatibilité
  // ...
}
```

## 🧪 Tests à Effectuer

### 1. Scan 404 Manuel
```bash
# Dans le dashboard
curl -X POST http://localhost:3000/api/404/scan
```

**Attendu** :
- `www.bordeaux-demenageur.fr` : ~150 pages vérifiées
- Taux d'erreur cohérent avec les autres sites

### 2. Crawler Complet
```bash
# Dans le dashboard
curl -X POST http://localhost:3000/api/404/crawl
```

**Attendu** :
- `www.bordeaux-demenageur.fr` : 150 pages crawlées (comme les autres)
- Détection des liens internes fonctionnelle

### 3. ETL GSC (si activé)
```bash
cd etl
npx tsx gsc/fetch-simple.ts
```

**Attendu** :
- Domaine `www.bordeaux-demenageur.fr` traité correctement
- Pas d'erreur "site not found"

## 📝 Variables d'Environnement CapRover

⚠️ **Important** : Si `SITES_LIST` est défini dans CapRover, mettre à jour :

```bash
# Ancien
SITES_LIST=...,bordeaux-demenageur.fr,...

# Nouveau
SITES_LIST=...,www.bordeaux-demenageur.fr,...
```

**Localisation** : CapRover → Apps → dd-dashboard → App Configs → Environment Variables

## ✅ Résultat Attendu

Après redéploiement, le dashboard devrait afficher :

| Site | Pages Vérifiées | Erreurs 404 | Liens Cassés | Taux d'Erreur |
|------|----------------|-------------|--------------|---------------|
| www.bordeaux-demenageur.fr | **~150** | X | Y | Z% |

Au lieu de :

| Site | Pages Vérifiées | Erreurs 404 | Liens Cassés | Taux d'Erreur |
|------|----------------|-------------|--------------|---------------|
| bordeaux-demenageur.fr | **1** | 0 | 0 | 0.0% |

## 🚀 Déploiement

### Rebuild Dashboard
```bash
cd dashboard
npm run build
```

### Git Commit
```bash
git add .
git commit -m "fix: utiliser www.bordeaux-demenageur.fr partout"
git push origin main
```

### CapRover Deploy
```bash
git push caprover main
```

**Durée rebuild** : ~3-5 min

---

**Status** : ✅ Corrigé  
**Testé** : ⏳ À tester après déploiement  
**Impact** : 1 site sur 11 (Bordeaux uniquement)

