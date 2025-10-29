/**
 * Script pour vérifier l'état de BigQuery
 */

import { BigQuery } from '@google-cloud/bigquery'

const PROJECT_ID = 'moverz-dashboard'

async function main() {
  const bigquery = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  })
  
  console.log('🔍 Vérification BigQuery...\n')
  
  // 1. Lister tous les datasets
  console.log('📦 Datasets existants:')
  const [datasets] = await bigquery.getDatasets()
  
  if (datasets.length === 0) {
    console.log('   ⚠️  Aucun dataset trouvé !\n')
  } else {
    datasets.forEach((dataset) => {
      console.log(`   - ${dataset.id} (location: ${dataset.location})`)
    })
    console.log('')
  }
  
  // 2. Vérifier le dataset analytics_core
  console.log('🔍 Vérification du dataset "analytics_core":')
  const dataset = bigquery.dataset('analytics_core')
  const [exists] = await dataset.exists()
  
  if (exists) {
    console.log('   ✅ Dataset existe !')
    
    // Vérifier les tables
    const [tables] = await dataset.getTables()
    console.log(`   📊 ${tables.length} table(s):`)
    tables.forEach((table) => {
      console.log(`      - ${table.id}`)
    })
  } else {
    console.log('   ❌ Dataset N\'EXISTE PAS !\n')
  }
  
  // 3. Vérifier les permissions du Service Account
  console.log('\n🔐 Service Account utilisé:')
  const credentials = JSON.parse(process.env.GCP_SA_KEY_JSON || '{}')
  console.log(`   Email: ${credentials.client_email}`)
}

main().catch((error) => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})

