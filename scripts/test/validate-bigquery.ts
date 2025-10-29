/**
 * Valider la configuration BigQuery
 */

import { bigquery, tableExists, query } from '../../etl/shared/bigquery-client.js'
import { SITES } from '../../etl/shared/types.js'
import { log } from '../../etl/shared/error-handler.js'

// ========================================
// TESTS
// ========================================

const REQUIRED_TABLES = [
  'sites',
  'gsc_global',
  'gsc_pages',
  'gsc_queries',
  'leads',
  'web_vitals',
  'alerts',
  'etl_jobs_log',
]

async function validateTables(): Promise<boolean> {
  log('info', '🔍 Checking BigQuery tables...')
  
  let allExist = true

  for (const table of REQUIRED_TABLES) {
    const exists = await tableExists(table)
    
    if (exists) {
      log('info', `✅ Table '${table}' exists`)
    } else {
      log('error', `❌ Table '${table}' NOT FOUND`)
      allExist = false
    }
  }

  return allExist
}

async function validateSitesData(): Promise<boolean> {
  log('info', '🔍 Checking sites data...')

  try {
    const sites = await query<any>('SELECT * FROM `moverz.sites` ORDER BY city')
    
    if (sites.length === 0) {
      log('error', '❌ No sites found in table')
      return false
    }

    if (sites.length !== 11) {
      log('warn', `⚠️  Expected 11 sites, found ${sites.length}`)
    }

    log('info', `✅ Found ${sites.length} sites:`)
    sites.forEach((site: any) => {
      log('info', `   - ${site.city}: ${site.domain}`)
    })

    return true
  } catch (error: any) {
    log('error', 'Failed to query sites', { error: error.message })
    return false
  }
}

async function validatePermissions(): Promise<boolean> {
  log('info', '🔍 Checking BigQuery permissions...')

  try {
    // Tester INSERT
    const testRow = {
      job_name: 'test-validation',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: 'success',
      rows_processed: 0,
      errors: '',
      duration_seconds: 0,
    }

    await bigquery.dataset('moverz').table('etl_jobs_log').insert([testRow])
    
    log('info', '✅ INSERT permission OK')

    // Tester SELECT
    await query('SELECT COUNT(*) as count FROM `moverz.etl_jobs_log`')
    
    log('info', '✅ SELECT permission OK')

    return true
  } catch (error: any) {
    log('error', 'Permission error', { error: error.message })
    return false
  }
}

async function validateSchema(): Promise<boolean> {
  log('info', '🔍 Checking table schemas...')

  try {
    const [metadata] = await bigquery.dataset('moverz').table('gsc_global').getMetadata()
    
    const fields = metadata.schema.fields.map((f: any) => f.name)
    const requiredFields = ['site', 'date', 'impressions', 'clicks', 'ctr', 'position']
    
    const missingFields = requiredFields.filter(f => !fields.includes(f))
    
    if (missingFields.length > 0) {
      log('error', `❌ Missing fields in gsc_global: ${missingFields.join(', ')}`)
      return false
    }

    log('info', '✅ Schema valid')

    return true
  } catch (error: any) {
    log('error', 'Schema validation failed', { error: error.message })
    return false
  }
}

// ========================================
// RUN VALIDATION
// ========================================

async function runValidation() {
  console.log('')
  console.log('🧪 ========================================')
  console.log('🧪 VALIDATION BIGQUERY')
  console.log('🧪 ========================================')
  console.log('')

  const results = {
    tables: await validateTables(),
    sitesData: await validateSitesData(),
    permissions: await validatePermissions(),
    schema: await validateSchema(),
  }

  console.log('')
  console.log('📊 ========================================')
  console.log('📊 RÉSULTATS')
  console.log('📊 ========================================')
  console.log(`  Tables: ${results.tables ? '✅' : '❌'}`)
  console.log(`  Sites Data: ${results.sitesData ? '✅' : '❌'}`)
  console.log(`  Permissions: ${results.permissions ? '✅' : '❌'}`)
  console.log(`  Schema: ${results.schema ? '✅' : '❌'}`)
  console.log('')

  const allPassed = Object.values(results).every(r => r === true)

  if (allPassed) {
    console.log('✅ All validations passed!')
    console.log('')
    console.log('🚀 Ready to run ETL jobs:')
    console.log('   npm run etl:gsc')
    console.log('   npm run etl:leads')
    console.log('')
  } else {
    console.log('❌ Some validations failed')
    console.log('')
    console.log('💡 Troubleshooting:')
    console.log('   1. Check .env configuration')
    console.log('   2. Run: npm run setup:bigquery')
    console.log('   3. Check service account permissions')
    console.log('')
  }

  return allPassed
}

// ========================================
// CLI
// ========================================

runValidation().then((success) => {
  process.exit(success ? 0 : 1)
})

