/**
 * Configuration centralisée
 */

// ========================================
// GOOGLE CLOUD & BIGQUERY
// ========================================

export const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'moverz-dashboard'
export const BQ_DATASET = process.env.BQ_DATASET || 'analytics_core'
export const BQ_TABLE_NAME = process.env.BQ_TABLE_NAME || 'gsc_daily_aggregated' // Nouvelle table (v2)
export const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS

// Rétrocompatibilité avec anciens noms
export const BIGQUERY_DATASET = BQ_DATASET

// ========================================
// SITES
// ========================================

// Parse SITES_LIST depuis env (format: domain1.fr,domain2.fr,...)
const sitesListEnv = process.env.SITES_LIST || ''

export const SITES_DOMAINS = sitesListEnv
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

// Si SITES_LIST vide, utiliser la liste hardcodée
export const DEFAULT_SITES = [
  'devis-demenageur-marseille.fr',
  'devis-demenageur-toulousain.fr',
  'devis-demenageur-lyon.fr',
  'www.bordeaux-demenageur.fr',
  'devis-demenageur-nantes.fr',
  'devis-demenageur-lille.fr',
  'devis-demenageur-nice.fr',
  'devis-demenageur-strasbourg.fr',
  'devis-demenageur-rouen.fr',
  'devis-demenageur-rennes.fr',
  'devis-demenageur-montpellier.fr',
]

export const ACTIVE_SITES = SITES_DOMAINS.length > 0 ? SITES_DOMAINS : DEFAULT_SITES

// ========================================
// FETCH
// ========================================

export const FETCH_DAYS = parseInt(process.env.FETCH_DAYS || '3', 10)
export const TIMEZONE = process.env.TIMEZONE || 'Europe/Paris'

// ========================================
// NODE ENV
// ========================================

export const NODE_ENV = process.env.NODE_ENV || 'development'
export const PORT = parseInt(process.env.PORT || '3000', 10)

// ========================================
// VALIDATION
// ========================================

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!GCP_PROJECT_ID) {
    errors.push('GCP_PROJECT_ID is required')
  }

  if (!BQ_DATASET) {
    errors.push('BQ_DATASET is required')
  }

  if (!GOOGLE_APPLICATION_CREDENTIALS) {
    errors.push('GOOGLE_APPLICATION_CREDENTIALS is required')
  }

  if (ACTIVE_SITES.length === 0) {
    errors.push('No sites configured (SITES_LIST is empty)')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// Afficher la config au démarrage (mode debug)
if (process.env.DEBUG === 'true') {
  console.log('📝 Configuration:')
  console.log(`  GCP_PROJECT_ID: ${GCP_PROJECT_ID}`)
  console.log(`  BQ_DATASET: ${BQ_DATASET}`)
  console.log(`  BQ_TABLE_NAME: ${BQ_TABLE_NAME}`)
  console.log(`  SITES: ${ACTIVE_SITES.length} sites`)
  console.log(`  FETCH_DAYS: ${FETCH_DAYS}`)
  console.log(`  NODE_ENV: ${NODE_ENV}`)
}

