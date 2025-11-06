#!/bin/bash
# Script pour nettoyer et relancer le serveur dev

cd "$(dirname "$0")"

echo "🧹 Nettoyage du cache Next.js..."
rm -rf .next

echo "🚀 Relance du serveur dev..."
npm run dev

