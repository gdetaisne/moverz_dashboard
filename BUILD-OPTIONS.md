# 🚀 Options de Build pour CapRover

## 📊 Situation Actuelle

Le Dockerfile actuel build **ETL + Dashboard** dans une seule image (~800MB, 10-15min de build).

**Problème** : Build lent car copie tout le monorepo même si seul le Dashboard est utilisé.

---

## 🎯 3 Options de Build

### **Option 1 : Image UNIQUE Optimisée** ⭐ RECOMMANDÉ

**Principe** : Garder une seule image qui peut faire ETL OU Dashboard via `APP_MODE`.

**Avantages** :
- ✅ Une seule app CapRover à gérer
- ✅ Déjà implémenté et fonctionnel
- ✅ Build déjà optimisé avec standalone (~3-5min)
- ✅ **Aucune fonctionnalité perdue**

**Inconvénients** :
- ⚠️ Image ~300MB (plus petite qu'avant mais pas minimale)
- ⚠️ Build 3-5min (acceptable)

**Configuration CapRover** :
```bash
APP_MODE=dashboard  # Pour le dashboard web
# ou
APP_MODE=etl        # Pour cron jobs
```

**Gain** : Build **3-5min** au lieu de 10-15min ✅

---

### **Option 2 : 2 Images SÉPARÉES** 🔀

**Principe** : Créer 2 apps CapRover distinctes (dd-dashboard + dd-etl).

**Avantages** :
- ✅ Build très rapide pour chaque image (~1-2min chacune)
- ✅ Images plus légères (~100MB chacune)
- ✅ Déploiements indépendants

**Inconvénients** :
- ⚠️ 2 apps à gérer dans CapRover
- ⚠️ 2 DNS à configurer
- ⚠️ Variables d'env à dupliquer
- ⚠️ La route `/api/etl/run` du dashboard ne fonctionnera PLUS
  (car l'ETL est dans une autre image)

**Nouveau fichier** : `Dockerfile.dashboard` (Next.js uniquement)

**Gain** : Build **1-2min** par image ✅

---

### **Option 3 : Next.js STANDALONE Pur** 🎯

**Principe** : Créer une image NEXT.JS PURE (sans ETL ni monorepo).

**Avantages** :
- ✅ Build ultra-rapide (~1min)
- ✅ Image très légère (~50MB)
- ✅ Plus simple à maintenir

**Inconvénients** :
- ❌ Perte de la route `/api/etl/run` (qui lance l'ETL manuellement)
- ❌ Plus besoin de `APP_MODE`
- ⚠️ L'ETL devient uniquement accessible via cron externe

**Gain** : Build **~1min** ✅

---

## 💡 Recommandation

### **Option 1 : Image UNIQUE Optimisée** ⭐

**Pourquoi** :
1. ✅ **Aucune fonctionnalité perdue** : `/api/etl/run` continue de fonctionner
2. ✅ Build déjà optimisé (3-5min acceptable)
3. ✅ Une seule app à gérer
4. ✅ Déjà implémenté et testé

**Build time** : ~3-5min (acceptable pour un monorepo)

---

## 🔧 Comparaison Rapide

| Critère | Option 1 (Unique) | Option 2 (Séparé) | Option 3 (Pur) |
|---------|-------------------|-------------------|----------------|
| **Build time** | 3-5min | 1-2min | ~1min |
| **Image size** | ~300MB | ~100MB × 2 | ~50MB |
| **Fonctionnalités** | ✅ Toutes | ⚠️ Pas d'ETL manuel | ❌ Pas d'ETL |
| **Complexité** | Simple | Moyenne | Simple |
| **Apps CapRover** | 1 | 2 | 1 |
| **Config ENV** | 1 app | 2 apps | 1 app |

---

## ✅ Conclusion

**L'Option 1 est déjà implémentée et optimisée.**

Les optimisations appliquées (standalone mode, Docker cache, .dockerignore) réduisent le build de **10-15min → 3-5min**.

**Tu veux que je passe à l'Option 2 ou 3 ?**
- Option 2 = Je crée `Dockerfile.dashboard` + guide pour 2 apps
- Option 3 = Je crée image Next.js pure (mais perte de `/api/etl/run`)

Sinon, on reste sur l'**Option 1** qui est déjà optimisée ! ✅

