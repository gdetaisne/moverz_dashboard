# Setup Agent Traffic Analyst

## 🔑 Variables d'environnement requises

### Option 1 : Développement local

Créer un fichier `.env` à la racine du projet :

```bash
# OpenAI (requis pour l'agent IA)
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4-turbo-preview  # ou gpt-4o-mini pour économiser

# BigQuery (déjà configuré)
GCP_PROJECT_ID=moverz-dashboard
BQ_DATASET=analytics_core
GOOGLE_APPLICATION_CREDENTIALS=./credentials/sa-key.json
```

### Option 2 : CapRover (Production)

Dans CapRover App Settings → Environment Variables :

```bash
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4-turbo-preview
```

## 📝 Obtenir une clé OpenAI

1. Aller sur https://platform.openai.com/api-keys
2. Créer une nouvelle clé API
3. Copier la clé (commence par `sk-`)
4. Ajouter au `.env` ou aux variables CapRover

## 💰 Coûts estimés

### GPT-4 Turbo (recommandé)
- Input : $0.01 / 1K tokens
- Output : $0.03 / 1K tokens
- Par analyse : ~$0.10-0.16
- Par mois (quotidien) : ~$3-5

### GPT-4o-mini (économique)
- Input : $0.15 / 1M tokens
- Output : $0.60 / 1M tokens
- Par analyse : ~$0.001-0.002
- Par mois (quotidien) : ~$0.03-0.06

**Recommandation** : Commencer avec `gpt-4o-mini` pour tester, puis passer à `gpt-4-turbo-preview` pour de meilleurs résultats.

## ⚠️ Comportement sans clé

Si `OPENAI_API_KEY` n'est pas configurée :
- ✅ Le reste du système fonctionne normalement
- ✅ L'ETL continue de mettre à jour BigQuery
- ❌ L'agent IA ne s'exécute pas (log d'avertissement)
- ❌ Pas d'insights générés

**L'agent ne bloque pas le système**, il échoue silencieusement avec un warning.

## 🧪 Tester l'agent

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer la clé OpenAI dans .env

# 3. Lancer l'agent manuellement
npx tsx agents/traffic-analyst/agent.ts

# Ou lancer via orchestrateur
npm run agents:run
```

## 🔧 Troubleshooting

### Erreur "OPENAI_API_KEY not found"
- Vérifier que la clé est bien dans `.env` (développement) ou variables CapRover (production)
- Redémarrer le scheduler après ajout de la variable

### Erreur "Insufficient quota"
- Vérifier votre compte OpenAI : https://platform.openai.com/usage
- Augmenter les limites dans les paramètres du compte

### Erreur "Rate limit exceeded"
- L'agent fait trop de requêtes simultanées
- Attendre quelques minutes et réessayer
- Considérer réduire la fréquence d'exécution

