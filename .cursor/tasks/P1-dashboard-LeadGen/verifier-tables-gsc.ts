/**
 * Vérifier quelles tables GSC existent dans BigQuery
 */

import { BigQuery } from '@google-cloud/bigquery'

const BQ_PROJECT_ID = process.env.GCP_PROJECT_ID || 'moverz-dashboard'
const BQ_DATASET = process.env.BQ_DATASET || 'analytics_core'
const BQ_LOCATION = process.env.BQ_LOCATION || 'europe-west1'

const bigquery = new BigQuery({
  projectId: BQ_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  credentials: process.env.GCP_SA_KEY_JSON ? JSON.parse(process.env.GCP_SA_KEY_JSON) : undefined,
})

async function main() {
  console.log('🔍 Vérification des tables GSC dans BigQuery\n')
  console.log(`Project: ${BQ_PROJECT_ID}`)
  console.log(`Dataset: ${BQ_DATASET}\n`)

  try {
    // Lister toutes les tables du dataset
    const query = `
      SELECT table_name, table_type
      FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.INFORMATION_SCHEMA.TABLES\`
      WHERE table_name LIKE '%gsc%' OR table_name LIKE '%search%'
      ORDER BY table_name
    `
    const [rows] = await bigquery.query({ query, location: BQ_LOCATION })
    
    if (rows.length === 0) {
      console.log('❌ Aucune table GSC trouvée\n')
      console.log('Tables possibles attendues:')
      console.log('  - gsc_daily_aggregated')
      console.log('  - gsc_daily_metrics')
      console.log('  - gsc_global')
      console.log('  - gsc_pages')
      console.log('  - gsc_queries\n')
    } else {
      console.log(`✅ ${rows.length} table(s) GSC trouvée(s):\n`)
      rows.forEach((row: any) => {
        console.log(`   - ${row.table_name} (${row.table_type})`)
      })
      console.log()
    }

    // Lister toutes les tables du dataset
    const allTablesQuery = `
      SELECT table_name, table_type
      FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.INFORMATION_SCHEMA.TABLES\`
      ORDER BY table_name
    `
    const [allRows] = await bigquery.query({ query: allTablesQuery, location: BQ_LOCATION })
    
    console.log(`📊 Toutes les tables du dataset (${allRows.length}):\n`)
    allRows.forEach((row: any) => {
      console.log(`   - ${row.table_name} (${row.table_type})`)
    })
    console.log()

  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    if (error.message.includes('does not exist')) {
      console.log('\n💡 Le dataset n\'existe peut-être pas encore.')
      console.log('   Vérifier que l\'ETL a été exécuté au moins une fois.')
    }
    process.exit(1)
  }
}

main()

