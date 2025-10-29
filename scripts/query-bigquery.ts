/**
 * Script pour interroger BigQuery et vérifier les données
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
  
  console.log('📊 Vérification des données BigQuery...\n')
  
  // 1. Compter le nombre total de lignes
  const countQuery = `
    SELECT COUNT(*) as total_rows
    FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\`
  `
  
  const [countRows] = await bigquery.query(countQuery)
  console.log(`✅ Total de lignes : ${countRows[0].total_rows}\n`)
  
  // 2. Grouper par domaine
  const byDomainQuery = `
    SELECT 
      domain,
      COUNT(*) as row_count,
      SUM(clicks) as total_clicks,
      SUM(impressions) as total_impressions,
      ROUND(AVG(ctr), 4) as avg_ctr,
      ROUND(AVG(position), 2) as avg_position
    FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\`
    GROUP BY domain
    ORDER BY total_impressions DESC
  `
  
  const [domainRows] = await bigquery.query(byDomainQuery)
  console.log('📈 Métriques par domaine:\n')
  console.table(domainRows)
  
  // 3. Dernières données ingérées
  const recentQuery = `
    SELECT 
      domain,
      COUNT(DISTINCT date) as unique_dates,
      MIN(date) as earliest_date,
      MAX(date) as latest_date,
      MAX(ingested_at) as last_ingested
    FROM \`${PROJECT_ID}.${DATASET}.${TABLE}\`
    GROUP BY domain
    ORDER BY domain
  `
  
  const [recentRows] = await bigquery.query(recentQuery)
  console.log('\n📅 Plages de dates par domaine:\n')
  console.table(recentRows)
}

main().catch((error) => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})

