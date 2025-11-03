#!/bin/bash

# Script de vérification des exports invalides dans les routes Next.js API

echo "🔍 Vérification des exports dans les routes API..."
echo ""

cd "$(dirname "$0")/../dashboard" || exit 1

ERRORS=0

# Trouver tous les fichiers route.ts
ROUTES=$(find app/api -name "route.ts" -type f)

if [ -z "$ROUTES" ]; then
  echo "❌ Aucun fichier route.ts trouvé dans app/api/"
  exit 1
fi

# Exports autorisés par Next.js
ALLOWED_EXPORTS=(
  "export async function GET"
  "export async function POST"
  "export async function PUT"
  "export async function DELETE"
  "export async function PATCH"
  "export const dynamic"
  "export const revalidate"
  "export const runtime"
)

for route in $ROUTES; do
  echo "📄 Vérification de: $route"
  
  # Extraire tous les exports
  EXPORTS=$(grep "^export" "$route" 2>/dev/null || true)
  
  if [ -z "$EXPORTS" ]; then
    echo "   ✅ Aucun export trouvé"
    continue
  fi
  
  # Vérifier chaque export
  while IFS= read -r export_line; do
    # Ignorer les lignes de commentaires ou vides
    if [[ "$export_line" =~ ^[[:space:]]*$ ]] || [[ "$export_line" =~ ^[[:space:]]*// ]]; then
      continue
    fi
    
    # Vérifier si l'export est autorisé
    IS_ALLOWED=0
    for allowed in "${ALLOWED_EXPORTS[@]}"; do
      if [[ "$export_line" =~ $allowed ]]; then
        IS_ALLOWED=1
        break
      fi
    done
    
    if [ $IS_ALLOWED -eq 0 ]; then
      echo "   ❌ Export invalide: $export_line"
      echo "      → Next.js n'autorise que: GET, POST, PUT, DELETE, PATCH, dynamic, revalidate, runtime"
      echo "      → Déplacer cette fonction/constante dans lib/"
      ERRORS=$((ERRORS + 1))
    fi
  done <<< "$EXPORTS"
done

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "✅ Tous les exports sont valides !"
  exit 0
else
  echo "❌ $ERRORS export(s) invalide(s) trouvé(s)"
  echo ""
  echo "💡 Solution: Déplacer les fonctions/constantes dans dashboard/lib/"
  exit 1
fi

