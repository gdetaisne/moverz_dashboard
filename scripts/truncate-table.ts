/**
 * Vider la table gsc_daily_metrics pour refaire un import propre
 */

import { BigQuery } from '@google-cloud/bigquery'

const PROJECT_ID = 'moverz-dashboard'
const DATASET = 'analytics_core'
const TABLE = 'gsc_daily_metrics'

async function main() {
  const bigquery = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  })
  
  console.log(`🗑️  Suppression des données de ${TABLE}...\n`)
  
  const query = `DELETE FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\` WHERE true`
  
  const [job] = await bigquery.createQueryJob({ query })
  await job.getQueryResults()
  
  console.log('✅ Table vidée avec succès !\n')
  console.log('📋 Prochaine étape : Relancer l\'ETL pour récupérer les données avec clics\n')
}

main().catch((error) => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})

