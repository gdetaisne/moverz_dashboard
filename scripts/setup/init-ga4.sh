#!/bin/bash

# ========================================
# INIT GA4 - Guide de configuration Google Analytics 4
# ========================================

echo "📊 Configuration Google Analytics 4 pour Moverz"
echo ""
echo "Ce script est un GUIDE INTERACTIF (pas d'automatisation GA4 API)"
echo ""

# ----------------------------------------
# 1. Prérequis
# ----------------------------------------

echo "✅ ÉTAPE 1: Prérequis"
echo ""
echo "Vous devez avoir:"
echo "  - Un compte Google"
echo "  - Accès à https://analytics.google.com"
echo ""
read -p "Continuer ? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# ----------------------------------------
# 2. Créer la propriété GA4
# ----------------------------------------

echo ""
echo "✅ ÉTAPE 2: Créer la propriété GA4"
echo ""
echo "1. Aller sur https://analytics.google.com"
echo "2. Cliquer sur 'Admin' (roue dentée en bas à gauche)"
echo "3. Colonne 'Compte' → Créer un compte (si nécessaire)"
echo "4. Colonne 'Propriété' → Créer une propriété"
echo ""
echo "Configuration recommandée:"
echo "  - Nom: Moverz - Réseau Multi-Sites"
echo "  - Fuseau horaire: Europe/Paris"
echo "  - Devise: EUR"
echo "  - Type d'entreprise: Services en ligne"
echo ""
read -p "Propriété créée ? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Créez la propriété puis relancez ce script"
    exit 0
fi

# ----------------------------------------
# 3. Créer les 11 data streams
# ----------------------------------------

echo ""
echo "✅ ÉTAPE 3: Créer les 11 data streams"
echo ""
echo "Dans votre propriété GA4:"
echo "  1. Aller dans Admin → Data Streams"
echo "  2. Cliquer 'Add stream' → 'Web'"
echo "  3. Créer 11 streams (1 par domaine):"
echo ""

DOMAINS=(
    "devis-demenageur-marseille.fr"
    "devis-demenageur-toulousain.fr"
    "devis-demenageur-lyon.fr"
    "bordeaux-demenageur.fr"
    "devis-demenageur-nantes.fr"
    "devis-demenageur-lille.fr"
    "devis-demenageur-nice.fr"
    "devis-demenageur-strasbourg.fr"
    "devis-demenageur-rouen.fr"
    "devis-demenageur-rennes.fr"
    "devis-demenageur-montpellier.fr"
)

for domain in "${DOMAINS[@]}"; do
    echo "     - $domain"
done

echo ""
echo "Pour chaque stream:"
echo "  - Website URL: https://$domain"
echo "  - Stream name: [ville] (ex: Marseille)"
echo "  - Enhanced measurement: ACTIVÉ"
echo ""
read -p "11 streams créés ? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Créez les 11 streams puis relancez ce script"
    exit 0
fi

# ----------------------------------------
# 4. Noter le Measurement ID
# ----------------------------------------

echo ""
echo "✅ ÉTAPE 4: Récupérer le Measurement ID"
echo ""
echo "Dans Data Streams, cliquer sur le premier stream."
echo "En haut à droite, vous verrez le Measurement ID (format: G-XXXXXXXXXX)"
echo ""
echo "⚠️  IMPORTANT: Tous les streams partagent le MÊME Measurement ID"
echo ""
read -p "Entrez votre Measurement ID (G-XXXXXXXXXX): " GA4_ID

if [[ ! $GA4_ID =~ ^G-[A-Z0-9]{10}$ ]]; then
    echo "❌ Format invalide. Doit être G-XXXXXXXXXX"
    exit 1
fi

echo "✅ Measurement ID: $GA4_ID"

# ----------------------------------------
# 5. Configurer les événements custom
# ----------------------------------------

echo ""
echo "✅ ÉTAPE 5: Configurer les événements custom"
echo ""
echo "Événements à configurer (Admin → Events):"
echo ""
echo "  1. cta_click"
echo "     - Paramètres: cta_type, destination, city"
echo "     - Marqué comme 'conversion'"
echo ""
echo "  2. form_start"
echo "     - Paramètres: form_type, city"
echo ""
echo "  3. form_submit"
echo "     - Paramètres: form_type, city"
echo "     - Marqué comme 'conversion'"
echo ""
echo "Ces événements seront envoyés automatiquement par le code tracking."
echo ""
read -p "Événements notés ? (y/n) " -n 1 -r
echo ""

# ----------------------------------------
# 6. Activer l'export BigQuery
# ----------------------------------------

echo ""
echo "✅ ÉTAPE 6: Activer l'export BigQuery"
echo ""
echo "1. Admin → Product Links → BigQuery Links"
echo "2. Cliquer 'Link'"
echo "3. Sélectionner votre projet GCP (moverz-analytics)"
echo "4. Configuration:"
echo "     - Export frequency: Daily"
echo "     - Include advertising identifiers: NON"
echo "     - Export events: Streaming (optionnel, coûte plus cher)"
echo ""
read -p "Export BigQuery activé ? (y/n) " -n 1 -r
echo ""

# ----------------------------------------
# 7. Mettre à jour .env
# ----------------------------------------

echo ""
echo "✅ ÉTAPE 7: Configuration .env"
echo ""

ENV_FILE="../../.env"

if grep -q "NEXT_PUBLIC_GA4_ID" "$ENV_FILE" 2>/dev/null; then
    echo "⚠️  GA4_ID existe déjà dans .env"
    sed -i.bak "s/NEXT_PUBLIC_GA4_ID=.*/NEXT_PUBLIC_GA4_ID=$GA4_ID/" "$ENV_FILE"
    echo "✅ .env mis à jour"
else
    echo "NEXT_PUBLIC_GA4_ID=$GA4_ID" >> "$ENV_FILE"
    echo "✅ GA4_ID ajouté à .env"
fi

# ----------------------------------------
# 8. Générer les fichiers tracking
# ----------------------------------------

echo ""
echo "✅ ÉTAPE 8: Génération des fichiers tracking Next.js"
echo ""

# On va générer les fichiers dans un dossier temporaire
# À copier manuellement vers moverz_main

TRACKING_DIR="../../generated/tracking"
mkdir -p "$TRACKING_DIR"

# Créer lib/analytics/ga4.ts
cat > "$TRACKING_DIR/ga4.ts" << 'EOF'
/**
 * Google Analytics 4 - Configuration & Helpers
 */

export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || ''

export function hasGA(): boolean {
  return typeof window !== 'undefined' && !!(window as any).gtag && !!GA4_ID
}

export function getSite(): string {
  if (typeof window === 'undefined') return 'unknown'
  
  const hostname = window.location.hostname
  
  // Mapping domaine → ville
  const siteMap: Record<string, string> = {
    'devis-demenageur-marseille.fr': 'marseille',
    'devis-demenageur-toulousain.fr': 'toulouse',
    'devis-demenageur-lyon.fr': 'lyon',
    'bordeaux-demenageur.fr': 'bordeaux',
    'devis-demenageur-nantes.fr': 'nantes',
    'devis-demenageur-lille.fr': 'lille',
    'devis-demenageur-nice.fr': 'nice',
    'devis-demenageur-strasbourg.fr': 'strasbourg',
    'devis-demenageur-rouen.fr': 'rouen',
    'devis-demenageur-rennes.fr': 'rennes',
    'devis-demenageur-montpellier.fr': 'montpellier',
  }
  
  return siteMap[hostname] || hostname.split('.')[0]
}

export function pageview(url: string): void {
  if (!hasGA()) return
  
  (window as any).gtag('event', 'page_view', {
    page_location: url,
    site: getSite(),
  })
}

export function event(
  name: string,
  params: Record<string, any> = {}
): void {
  if (!hasGA()) return
  
  (window as any).gtag('event', name, {
    ...params,
    site: getSite(),
  })
}

// Événements spécifiques
export function ctaClick(ctaType: string, destination: string): void {
  event('cta_click', {
    cta_type: ctaType,
    destination,
  })
}

export function formStart(formType: string = 'lead'): void {
  event('form_start', {
    form_type: formType,
  })
}

export function formSubmit(formType: string = 'lead'): void {
  event('form_submit', {
    form_type: formType,
  })
}
EOF

echo "✅ Fichier généré: $TRACKING_DIR/ga4.ts"

# Créer app/ga-listener.tsx
cat > "$TRACKING_DIR/ga-listener.tsx" << 'EOF'
'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { pageview } from '@/lib/analytics/ga4'

export default function GAListener() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : '')
    pageview(url)
  }, [pathname, searchParams])

  return null
}
EOF

echo "✅ Fichier généré: $TRACKING_DIR/ga-listener.tsx"

# Créer le snippet à ajouter dans layout.tsx
cat > "$TRACKING_DIR/layout-snippet.tsx" << EOF
// À ajouter dans app/layout.tsx (avant </head>)

import Script from 'next/script'
import GAListener from './ga-listener'

const GA4_ID = '$GA4_ID'

// Dans <head>
<Script
  src={\`https://www.googletagmanager.com/gtag/js?id=\${GA4_ID}\`}
  strategy="afterInteractive"
/>
<Script id="google-analytics" strategy="afterInteractive">
  {\`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '\${GA4_ID}', {
      page_path: window.location.pathname,
    });
  \`}
</Script>

// Dans <body> (après children)
<GAListener />
EOF

echo "✅ Fichier généré: $TRACKING_DIR/layout-snippet.tsx"

# ----------------------------------------
# FIN
# ----------------------------------------

echo ""
echo "✅ ========================================="
echo "✅ GA4 configuré avec succès !"
echo "✅ ========================================="
echo ""
echo "📂 Fichiers générés dans: $TRACKING_DIR/"
echo ""
echo "📋 Prochaines étapes:"
echo "  1. Copier les fichiers vers moverz_main:"
echo "     - $TRACKING_DIR/ga4.ts → moverz_main/lib/analytics/ga4.ts"
echo "     - $TRACKING_DIR/ga-listener.tsx → moverz_main/app/ga-listener.tsx"
echo ""
echo "  2. Modifier moverz_main/app/layout.tsx (voir layout-snippet.tsx)"
echo ""
echo "  3. Utiliser dans les composants:"
echo "     import { ctaClick, formStart, formSubmit } from '@/lib/analytics/ga4'"
echo ""
echo "  4. Tester avec GA4 DebugView:"
echo "     https://analytics.google.com/analytics/web/#/a/p/realtime/overview"
echo ""
echo "  5. Après 24h, vérifier l'export BigQuery"
echo ""

