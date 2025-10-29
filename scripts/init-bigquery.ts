/**
 * Script d'initialisation BigQuery
 * Crée le dataset analytics_core et la table gsc_daily_metrics
 * 
 * Usage:
 *   npx tsx scripts/init-bigquery.ts
 */

import { BigQuery } from '@google-cloud/bigquery'

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'moverz-dashboard'
const DATASET = process.env.BQ_DATASET || 'analytics_core'
const TABLE = 'gsc_daily_metrics'

async function main() {
  console.log('🔧 Initialisation BigQuery...')
  console.log(`   Project: ${PROJECT_ID}`)
  console.log(`   Dataset: ${DATASET}`)
  console.log('')
  
  const bigquery = new BigQuery({
    projectId: PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  })
  
  // 1. Créer le dataset
  console.log(`📦 Creating dataset ${DATASET}...`)
  try {
    const [dataset] = await bigquery.createDataset(DATASET, {
      location: 'EU',
      description: 'Moverz Analytics Core Dataset',
    })
    console.log(`   ✅ Dataset ${dataset.id} created`)
  } catch (error: any) {
    if (error.code === 409) {
      console.log(`   ℹ️  Dataset already exists`)
    } else {
      throw error
    }
  }
  
  // 2. Créer la table gsc_daily_metrics
  console.log(`📊 Creating table ${TABLE}...`)
  const dataset = bigquery.dataset(DATASET)
  
  const schema = [
    { name: 'date', type: 'DATE', mode: 'REQUIRED' },
    { name: 'domain', type: 'STRING', mode: 'REQUIRED' },
    { name: 'page', type: 'STRING', mode: 'REQUIRED' },
    { name: 'query', type: 'STRING', mode: 'REQUIRED' },
    { name: 'clicks', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'impressions', type: 'INTEGER', mode: 'REQUIRED' },
    { name: 'ctr', type: 'FLOAT', mode: 'REQUIRED' },
    { name: 'position', type: 'FLOAT', mode: 'REQUIRED' },
    { name: 'ingested_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
  ]
  
  const options = {
    schema,
    location: 'EU',
    timePartitioning: {
      type: 'DAY',
      field: 'date',
    },
    clustering: {
      fields: ['domain', 'page'],
    },
    description: 'Google Search Console metrics (V1 single table)',
  }
  
  try {
    const [table] = await dataset.createTable(TABLE, options)
    console.log(`   ✅ Table ${table.id} created`)
  } catch (error: any) {
    if (error.code === 409) {
      console.log(`   ℹ️  Table already exists`)
    } else {
      throw error
    }
  }
  
  console.log('')
  console.log('✅ BigQuery setup complete!')
  console.log('')
  console.log('📋 Next steps:')
  console.log('   1. Set APP_MODE=etl in CapRover')
  console.log('   2. Restart the app')
  console.log('')
}

main().catch((error) => {
  console.error('❌ Error:', error.message)
  process.exit(1)
})

