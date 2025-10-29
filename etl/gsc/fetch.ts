/**
 * ETL Google Search Console → BigQuery
 */

import { google } from 'googleapis'
import { insertRows } from '../shared/bigquery-client.js'
import { withErrorHandling, retry, log } from '../shared/error-handler.js'
import { SITES, type GSCGlobalMetrics, type GSCPageMetrics, type GSCQueryMetrics } from '../shared/types.js'
import type { ETLJobResult } from '../shared/types.js'

const searchconsole = google.searchconsole('v1')

// ========================================
// CONFIGURATION
// ========================================

const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

if (!SERVICE_ACCOUNT_KEY) {
  throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not found in env')
}

// ========================================
// AUTHENTIFICATION
// ========================================

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_KEY,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })

  return auth.getClient()
}

// ========================================
// FETCH GSC DATA
// ========================================

async function fetchGSCData(
  domain: string,
  startDate: string, // YYYY-MM-DD
  endDate: string
): Promise<{
  global: GSCGlobalMetrics[]
  pages: GSCPageMetrics[]
  queries: GSCQueryMetrics[]
}> {
  const authClient = await getAuthClient()
  const siteUrl = `sc-domain:${domain}`

  log('info', `Fetching GSC data for ${domain}`, { startDate, endDate })

  // Trouver le site correspondant
  const site = SITES.find(s => s.domain === domain)
  if (!site) {
    throw new Error(`Site ${domain} not found in SITES config`)
  }

  // 1. MÉTRIQUES GLOBALES
  const globalResponse = await searchconsole.searchanalytics.query({
    auth: authClient as any,
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['date'],
      rowLimit: 25000,
    },
  })

  const globalMetrics: GSCGlobalMetrics[] = (globalResponse.data.rows || []).map((row: any) => ({
    site: site.city,
    date: row.keys[0],
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }))

  // 2. MÉTRIQUES PAR PAGE (top 100)
  const pagesResponse = await searchconsole.searchanalytics.query({
    auth: authClient as any,
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['date', 'page'],
      rowLimit: 100,
    },
  })

  const pageMetrics: GSCPageMetrics[] = (pagesResponse.data.rows || []).map((row: any) => ({
    site: site.city,
    date: row.keys[0],
    url: row.keys[1],
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }))

  // 3. MÉTRIQUES PAR REQUÊTE (top 100)
  const queriesResponse = await searchconsole.searchanalytics.query({
    auth: authClient as any,
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['date', 'query'],
      rowLimit: 100,
    },
  })

  const queryMetrics: GSCQueryMetrics[] = (queriesResponse.data.rows || []).map((row: any) => ({
    site: site.city,
    date: row.keys[0],
    query: row.keys[1],
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }))

  return { global: globalMetrics, pages: pageMetrics, queries: queryMetrics }
}

// ========================================
// ETL PRINCIPAL
// ========================================

export async function runGSCETL(date?: string): Promise<ETLJobResult> {
  const startedAt = new Date()
  const targetDate = date || getYesterday()
  
  log('info', 'Starting GSC ETL', { targetDate })

  let totalRows = 0
  const errors: string[] = []

  for (const site of SITES) {
    try {
      log('info', `Processing ${site.domain}...`)

      const data = await retry(
        () => fetchGSCData(site.domain, targetDate, targetDate),
        { maxRetries: 3 }
      )

      // Insérer dans BigQuery
      await insertRows('gsc_global', data.global)
      await insertRows('gsc_pages', data.pages)
      await insertRows('gsc_queries', data.queries)

      totalRows += data.global.length + data.pages.length + data.queries.length
      
      log('info', `✅ ${site.domain}: ${totalRows} rows`)
    } catch (error: any) {
      log('error', `❌ ${site.domain} failed`, { error: error.message })
      errors.push(`${site.domain}: ${error.message}`)
    }
  }

  const completedAt = new Date()
  const status = errors.length === 0 ? 'success' : errors.length < SITES.length ? 'partial' : 'failed'

  return {
    jobName: 'gsc-fetch',
    startedAt,
    completedAt,
    status,
    rowsProcessed: totalRows,
    errors,
  }
}

// ========================================
// HELPERS
// ========================================

function getYesterday(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return date.toISOString().split('T')[0]
}

// ========================================
// EXÉCUTION CLI
// ========================================

if (import.meta.url === `file://${process.argv[1]}`) {
  withErrorHandling('gsc-fetch', async () => {
    const result = await runGSCETL()
    
    console.log('\n📊 Résultat:')
    console.log(`  Status: ${result.status}`)
    console.log(`  Rows: ${result.rowsProcessed}`)
    console.log(`  Duration: ${(result.completedAt.getTime() - result.startedAt.getTime()) / 1000}s`)
    
    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.length}`)
      result.errors.forEach(err => console.log(`    - ${err}`))
    }

    process.exit(result.status === 'failed' ? 1 : 0)
  })
}

