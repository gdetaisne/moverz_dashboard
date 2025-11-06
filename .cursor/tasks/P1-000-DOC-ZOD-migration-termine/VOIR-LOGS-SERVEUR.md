# 📊 Comment Voir les Logs Serveur

**Pour diagnostiquer l'erreur ETL, il faut consulter les logs serveur.**

---

## 🌐 Environnement Production

D'après l'URL dans les screenshots : **`dd-dashboard.gslv.cloud`**

Il s'agit probablement d'un déploiement **CapRover**.

---

## 🔍 Options pour Voir les Logs

### Option 1: Interface CapRover (Recommandée)

1. **Accéder à l'interface CapRover**
   - URL probable : `https://captain.gslv.cloud` ou similaire
   - Se connecter avec tes credentials

2. **Trouver l'app "dashboard"**
   - Dans la liste des apps
   - Cliquer sur l'app "dashboard" ou "dd-dashboard"

3. **Onglet "Logs"**
   - Cliquer sur l'onglet "Logs" ou "Log Viewer"
   - Voir les logs en temps réel

4. **Filtrer les logs**
   - Chercher `[etl/run]` pour voir les logs spécifiques à cette route
   - Chercher "error" pour voir toutes les erreurs

---

### Option 2: CLI CapRover

Si tu as accès SSH au serveur CapRover :

```bash
# Via CapRover CLI
caprover logs -a dashboard

# Ou directement Docker
docker logs dashboard-srv-captain --tail 100 -f
```

---

### Option 3: SSH Direct au Serveur

Si tu as accès SSH :

```bash
# Se connecter au serveur
ssh user@gslv.cloud

# Voir les logs Docker
docker ps  # Trouver le conteneur dashboard
docker logs <container-id> --tail 100 -f

# Ou logs CapRover
cd /var/lib/docker/volumes/captain--data/_data/
```

---

## 🔎 Ce qu'il faut Chercher dans les Logs

### Logs Structurés (avec notre nouveau logger)

```
[etl/run] Lancement manuel de l'ETL demandé
[etl/run] Chemins calculés { projectRoot: '...', etlScript: '...' }
[etl/run] Exécution du script ETL { script: '...', hasGCP_SA_KEY_JSON: true }
[etl/run] Erreur lors du lancement de l'ETL { errorDetails: { ... } }
```

### Messages d'erreur possibles :

1. **"Script ETL non trouvé"**
   ```
   [etl/run] Script ETL non trouvé { etlScript: '/app/../etl/gsc/fetch-simple.ts' }
   ```
   → Le chemin est incorrect en production

2. **"Variables d'environnement manquantes"**
   ```
   [etl/run] Variables d'environnement manquantes { missingVars: ['GCP_SA_KEY_JSON'] }
   ```
   → Une variable n'est pas définie

3. **"Command failed"**
   ```
   [etl/run] Erreur lors du lancement de l'ETL
   errorDetails: { stderr: 'GCP_SA_KEY_JSON is required\n...', ... }
   ```
   → Le script ETL a échoué (voir stderr pour détails)

---

## 📋 Checklist Diagnostic

### 1. Vérifier les Chemins

**Chercher dans les logs:**
```
[etl/run] Chemins calculés
```

**Vérifier:**
- `projectRoot` est-il correct ?
- `etlScript` pointe-t-il vers un fichier qui existe ?
- Structure Docker vs structure locale

### 2. Vérifier les Variables

**Chercher dans les logs:**
```
[etl/run] Exécution du script ETL
hasGCP_SA_KEY_JSON: true/false
hasSITES_LIST: true/false
```

**Vérifier:**
- Les variables sont-elles présentes ?
- Sont-elles passées au processus enfant ?

### 3. Voir l'Erreur Exacte

**Chercher dans les logs:**
```
[etl/run] Erreur lors du lancement de l'ETL
errorDetails.stderr
```

**C'est ici que tu trouveras la vraie erreur :**
- Message du script ETL (ex: "GCP_SA_KEY_JSON is required")
- Erreur système (ex: "ENOENT", "timeout")
- Erreur réseau BigQuery

---

## 🎯 Commandes Utiles CapRover

### Voir les logs en temps réel

```bash
# Via CapRover CLI
caprover logs -a dashboard --follow

# Voir seulement les erreurs
caprover logs -a dashboard | grep -i error

# Voir seulement ETL
caprover logs -a dashboard | grep "etl/run"
```

### Dans l'interface web CapRover

- Onglet "Logs" de l'app
- Filtrer par : `[etl/run]` ou `error`
- Temps réel : cocher "Follow logs"

---

## 🔧 Si Pas d'Accès aux Logs

### Alternative: Ajouter un Endpoint de Debug

Créer une route temporaire pour voir l'état :

```typescript
// GET /api/etl/debug
export async function GET() {
  return NextResponse.json({
    cwd: process.cwd(),
    projectRoot: path.resolve(process.cwd(), '..'),
    etlScript: path.join(path.resolve(process.cwd(), '..'), 'etl', 'gsc', 'fetch-simple.ts'),
    fileExists: fs.existsSync(path.join(path.resolve(process.cwd(), '..'), 'etl', 'gsc', 'fetch-simple.ts')),
    hasGCP_SA_KEY_JSON: !!process.env.GCP_SA_KEY_JSON,
    hasSITES_LIST: !!process.env.SITES_LIST,
    // ... autres vérifications
  })
}
```

Appeler : `https://dd-dashboard.gslv.cloud/api/etl/debug`

---

## 📝 Récapitulatif

**Méthode la plus simple :**

1. **Aller sur CapRover** (interface web)
2. **Cliquer sur l'app "dashboard"**
3. **Onglet "Logs"**
4. **Chercher `[etl/run]`** ou filtrer par "error"
5. **Lire les logs structurés** pour voir le problème exact

**Le logger structuré que nous avons ajouté va te donner toutes les infos nécessaires !**

---

**Si tu n'as pas accès à CapRover, dis-moi et on peut créer un endpoint de debug temporaire.**

