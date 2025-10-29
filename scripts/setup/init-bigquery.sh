#!/bin/bash

# ========================================
# INIT BIGQUERY - Setup Google Cloud & BigQuery
# ========================================

set -e

echo "🔧 Initialisation BigQuery pour Moverz Analytics"
echo ""

# ----------------------------------------
# 1. Vérifier les prérequis
# ----------------------------------------

if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI non trouvé"
    echo "Installation : https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "✅ gcloud CLI trouvé"

# ----------------------------------------
# 2. Configuration du projet
# ----------------------------------------

PROJECT_ID=${GCP_PROJECT_ID:-moverz-analytics}
DATASET=${BIGQUERY_DATASET:-moverz}
LOCATION="EU"

echo "📝 Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Dataset: $DATASET"
echo "  Location: $LOCATION"
echo ""

read -p "Continuer ? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# ----------------------------------------
# 3. Authentification
# ----------------------------------------

echo "🔐 Authentification Google Cloud..."
gcloud auth login

# ----------------------------------------
# 4. Créer/Sélectionner le projet
# ----------------------------------------

echo "📦 Vérification du projet..."

if gcloud projects describe $PROJECT_ID &> /dev/null; then
    echo "✅ Projet $PROJECT_ID existe déjà"
else
    echo "📦 Création du projet $PROJECT_ID..."
    gcloud projects create $PROJECT_ID --name="Moverz Analytics"
fi

gcloud config set project $PROJECT_ID

# ----------------------------------------
# 5. Activer les APIs nécessaires
# ----------------------------------------

echo "🔌 Activation des APIs..."

gcloud services enable bigquery.googleapis.com
gcloud services enable bigquerystorage.googleapis.com
gcloud services enable searchconsole.googleapis.com

echo "✅ APIs activées"

# ----------------------------------------
# 6. Créer le dataset BigQuery
# ----------------------------------------

echo "📊 Création du dataset $DATASET..."

if bq ls -d | grep -q $DATASET; then
    echo "✅ Dataset $DATASET existe déjà"
else
    bq mk --location=$LOCATION --dataset $PROJECT_ID:$DATASET
    echo "✅ Dataset $DATASET créé"
fi

# ----------------------------------------
# 7. Créer le service account
# ----------------------------------------

SERVICE_ACCOUNT_NAME="moverz-etl"
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

echo "👤 Création du service account..."

if gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL &> /dev/null; then
    echo "✅ Service account existe déjà"
else
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name="Moverz ETL Service Account" \
        --description="Service account pour les jobs ETL Moverz"
    echo "✅ Service account créé"
fi

# ----------------------------------------
# 8. Attribuer les permissions
# ----------------------------------------

echo "🔑 Attribution des permissions..."

# BigQuery Data Editor
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/bigquery.dataEditor" \
    --condition=None

# BigQuery Job User
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/bigquery.jobUser" \
    --condition=None

# Search Console (read-only)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/searchconsole.viewer" \
    --condition=None

echo "✅ Permissions attribuées"

# ----------------------------------------
# 9. Créer la clé JSON
# ----------------------------------------

KEY_FILE="../../../credentials/service-account.json"

echo "🔐 Création de la clé JSON..."

mkdir -p "$(dirname "$KEY_FILE")"

if [ -f "$KEY_FILE" ]; then
    echo "⚠️  Clé existe déjà : $KEY_FILE"
    read -p "Remplacer ? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "⏭️  Skip création clé"
    else
        gcloud iam service-accounts keys create "$KEY_FILE" \
            --iam-account="$SERVICE_ACCOUNT_EMAIL"
        echo "✅ Clé créée : $KEY_FILE"
    fi
else
    gcloud iam service-accounts keys create "$KEY_FILE" \
        --iam-account="$SERVICE_ACCOUNT_EMAIL"
    echo "✅ Clé créée : $KEY_FILE"
fi

# ----------------------------------------
# 10. Appliquer les migrations
# ----------------------------------------

echo "📊 Application des migrations BigQuery..."

# Vérifier que npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm non trouvé"
    exit 1
fi

cd ../../..

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

# Appliquer la migration
echo "🔄 Exécution migration 001_initial.sql..."

bq query --use_legacy_sql=false < db/migrations/001_initial.sql

echo "✅ Migration appliquée"

# ----------------------------------------
# 11. Seed des sites
# ----------------------------------------

echo "🌱 Seed des 11 sites..."

npm run db:seed

echo "✅ Seed terminé"

# ----------------------------------------
# 12. Mettre à jour .env
# ----------------------------------------

ENV_FILE=".env"

echo ""
echo "📝 Configuration .env:"
echo ""
echo "GCP_PROJECT_ID=$PROJECT_ID"
echo "BIGQUERY_DATASET=$DATASET"
echo "GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account.json"
echo ""

if [ -f "$ENV_FILE" ]; then
    echo "⚠️  Fichier .env existe déjà"
else
    echo "GCP_PROJECT_ID=$PROJECT_ID" >> $ENV_FILE
    echo "BIGQUERY_DATASET=$DATASET" >> $ENV_FILE
    echo "GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account.json" >> $ENV_FILE
    echo "✅ .env créé"
fi

# ----------------------------------------
# FIN
# ----------------------------------------

echo ""
echo "✅ ========================================="
echo "✅ BigQuery initialisé avec succès !"
echo "✅ ========================================="
echo ""
echo "📊 Prochaines étapes:"
echo "  1. Configurer Google Search Console (init-ga4.sh)"
echo "  2. Tester l'ETL GSC (npm run etl:gsc)"
echo "  3. Vérifier les données dans BigQuery"
echo ""
echo "🔗 Dashboard BigQuery:"
echo "   https://console.cloud.google.com/bigquery?project=$PROJECT_ID"
echo ""

