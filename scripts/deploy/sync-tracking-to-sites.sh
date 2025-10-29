#!/bin/bash

# ========================================
# SYNC TRACKING TO SITES
# Déployer le code tracking GA4 sur les 11 sites moverz_main
# ========================================

set -e

echo "🚀 Déploiement tracking GA4 vers moverz_main (11 sites)"
echo ""

# ----------------------------------------
# 1. Vérifier les prérequis
# ----------------------------------------

MOVERZ_MAIN_PATH="${MOVERZ_MAIN_PATH:-../../../moverz_main}"

if [ ! -d "$MOVERZ_MAIN_PATH" ]; then
    echo "❌ Dossier moverz_main non trouvé: $MOVERZ_MAIN_PATH"
    echo "Définir la variable: export MOVERZ_MAIN_PATH=/chemin/vers/moverz_main"
    exit 1
fi

echo "✅ moverz_main trouvé: $MOVERZ_MAIN_PATH"

# Vérifier que les fichiers tracking existent
TRACKING_DIR="../generated/tracking"

if [ ! -f "$TRACKING_DIR/ga4.ts" ]; then
    echo "❌ Fichiers tracking non générés"
    echo "Lancer d'abord: npm run setup:ga4"
    exit 1
fi

echo "✅ Fichiers tracking trouvés"

# ----------------------------------------
# 2. Copier les fichiers tracking
# ----------------------------------------

SITES=(
    "marseille"
    "toulouse"
    "lyon"
    "bordeaux"
    "nantes"
    "lille"
    "nice"
    "strasbourg"
    "rouen"
    "rennes"
    "montpellier"
)

echo ""
echo "📦 Copie des fichiers vers ${#SITES[@]} sites..."
echo ""

for site in "${SITES[@]}"; do
    SITE_PATH="$MOVERZ_MAIN_PATH/sites/$site"
    
    if [ ! -d "$SITE_PATH" ]; then
        echo "⚠️  Skip $site (dossier non trouvé)"
        continue
    fi
    
    echo "  📂 $site"
    
    # Créer lib/analytics si nécessaire
    mkdir -p "$SITE_PATH/lib/analytics"
    
    # Copier ga4.ts
    cp "$TRACKING_DIR/ga4.ts" "$SITE_PATH/lib/analytics/ga4.ts"
    echo "    ✅ ga4.ts"
    
    # Copier ga-listener.tsx
    cp "$TRACKING_DIR/ga-listener.tsx" "$SITE_PATH/app/ga-listener.tsx"
    echo "    ✅ ga-listener.tsx"
done

echo ""
echo "✅ Fichiers copiés sur ${#SITES[@]} sites"

# ----------------------------------------
# 3. Instructions layout.tsx
# ----------------------------------------

echo ""
echo "📝 ========================================="
echo "📝 PROCHAINE ÉTAPE MANUELLE"
echo "📝 ========================================="
echo ""
echo "Modifier app/layout.tsx sur chaque site:"
echo ""
cat "$TRACKING_DIR/layout-snippet.tsx"
echo ""
echo "📋 Checklist:"
echo "  1. Ajouter les imports en haut du fichier"
echo "  2. Ajouter les <Script> dans <head>"
echo "  3. Ajouter <GAListener /> dans <body>"
echo "  4. Vérifier que .env contient NEXT_PUBLIC_GA4_ID"
echo ""

# ----------------------------------------
# 4. Commit & push (optionnel)
# ----------------------------------------

read -p "Voulez-vous commit & push automatiquement ? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔄 Commit & push vers les 11 repos..."
    echo ""
    
    for site in "${SITES[@]}"; do
        SITE_PATH="$MOVERZ_MAIN_PATH/sites/$site"
        
        if [ ! -d "$SITE_PATH/.git" ]; then
            echo "⚠️  Skip $site (pas de .git)"
            continue
        fi
        
        cd "$SITE_PATH"
        
        # Vérifier s'il y a des changements
        if git diff --quiet && git diff --cached --quiet; then
            echo "  ⏭️  $site: aucun changement"
        else
            echo "  📤 $site: commit & push..."
            git add lib/analytics/ga4.ts app/ga-listener.tsx
            git commit -m "feat(analytics): add GA4 tracking"
            git push origin main
            echo "    ✅ Pushed"
        fi
    done
    
    cd - > /dev/null
    
    echo ""
    echo "✅ Déploiement terminé"
    echo ""
    echo "⏳ CapRover va rebuild les sites (~15 min)"
    echo "🔍 Vérifier les builds sur https://captain.your-domain.com"
else
    echo ""
    echo "⏭️  Commit manuel requis"
    echo ""
    echo "Commandes:"
    echo "  cd $MOVERZ_MAIN_PATH/sites/{ville}"
    echo "  git add lib/analytics/ga4.ts app/ga-listener.tsx"
    echo "  git commit -m 'feat(analytics): add GA4 tracking'"
    echo "  git push origin main"
fi

echo ""
echo "✅ Script terminé"

