/**
 * Vérifier les données brutes dans BigQuery
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
  
  console.log('🔍 Échantillon de données brutes (20 premières lignes):\n')
  
  const query = `
    SELECT 
      date,
      domain,
      page,
      query,
      clicks,
      impressions,
      ctr,
      position
    FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\`
    ORDER BY impressions DESC
    LIMIT 20
  `
  
  const [rows] = await bigquery.query(query)
  console.table(rows)
  
  console.log('\n📊 Statistiques des clics:')
  
  const statsQuery = `
    SELECT 
      COUNT(*) as total_rows,
      SUM(CASE WHEN clicks > 0 THEN 1 ELSE 0 END) as rows_with_clicks,
      SUM(CASE WHEN clicks = 0 THEN 1 ELSE 0 END) as rows_with_zero_clicks,
      MAX(clicks) as max_clicks,
      SUM(clicks) as total_clicks
    FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\`
  `
  
  const [stats] = await bigquery.query(statsQuery)
  console.table(stats)
}

main().catch((error) => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})

