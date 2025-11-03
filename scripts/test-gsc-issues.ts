/**
 * Script de test pour l'ETL GSC Issues
 * 
 * Usage:
 *   TEST_MODE=true MAX_URLS_PER_SITE=5 npm run test:gsc-issues
 */

import { fetchGSCIssues } from '../etl/gsc/fetch-issues.js'

async function main() {
  console.log('🧪 Test ETL GSC Issues')
  console.log('='.repeat(50))
  
  // Vérifier les variables requises
  const required = [
    'GCP_PROJECT_ID',
    'BQ_DATASET',
    'GCP_SA_KEY_JSON',
    'SITES_LIST',
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('❌ Variables d\'environnement manquantes:')
    missing.forEach(key => console.error(`   - ${key}`))
    console.error('\n💡 Créer un fichier .env avec ces variables ou les exporter:')
    console.error('   export GCP_PROJECT_ID=moverz-dashboard')
    console.error('   export BQ_DATASET=analytics_core')
    console.error('   export GCP_SA_KEY_JSON=\'{"type":"service_account",...}\'')
    console.error('   export SITES_LIST=devis-demenageur-marseille.fr')
    console.error('   export TEST_MODE=true  # Limite à 1 site et 5 pages')
    process.exit(1)
  }
  
  console.log('✅ Variables d\'environnement OK')
  console.log(`   - GCP_PROJECT_ID: ${process.env.GCP_PROJECT_ID}`)
  console.log(`   - BQ_DATASET: ${process.env.BQ_DATASET}`)
  console.log(`   - SITES_LIST: ${process.env.SITES_LIST?.split(',').length || 0} sites`)
  console.log(`   - TEST_MODE: ${process.env.TEST_MODE || 'false'}`)
  console.log(`   - MAX_URLS_PER_SITE: ${process.env.MAX_URLS_PER_SITE || '10'}`)
  console.log('')
  
  try {
    console.log('🚀 Lancement de l\'ETL...')
    await fetchGSCIssues()
    console.log('\n✅ Test terminé avec succès!')
  } catch (error: any) {
    console.error('\n❌ Erreur lors du test:', error.message)
    if (error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    process.exit(1)
  }
}

main()

