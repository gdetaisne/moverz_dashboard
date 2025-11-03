#!/bin/bash
# Script pour redémarrer le serveur Next.js

echo "🔄 Redémarrage du serveur Next.js..."

# Trouver et arrêter le processus sur le port 3000
PID=$(lsof -ti:3000)
if [ ! -z "$PID" ]; then
  echo "🛑 Arrêt du processus existant (PID: $PID)..."
  kill $PID
  sleep 2
  
  # Vérifier qu'il est bien arrêté
  if lsof -ti:3000 > /dev/null 2>&1; then
    echo "⚠️  Le processus ne s'est pas arrêté, force kill..."
    kill -9 $PID
    sleep 1
  fi
  echo "✅ Processus arrêté"
else
  echo "ℹ️  Aucun processus sur le port 3000"
fi

# Attendre un peu
sleep 1

# Vérifier que .env.local existe
if [ ! -f ".env.local" ]; then
  echo "❌ Erreur: .env.local n'existe pas dans dashboard/"
  exit 1
fi

echo "✅ .env.local trouvé"

# Démarrer le serveur
echo "🚀 Démarrage du serveur Next.js..."
echo ""
echo "📝 Le serveur va démarrer. Pour l'arrêter, utilisez Ctrl+C"
echo ""

npm run dev

