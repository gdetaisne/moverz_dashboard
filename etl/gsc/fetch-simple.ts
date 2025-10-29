/**
 * ETL GSC Simple (V1)
 * 
 * Extraction Google Search Console → BigQuery (table unique)
 * - Dimensions: date, page, query
 * - MERGE upsert sur (date, domain, page, query)
 * - Codes sortie: 0 (success), 1 (error), 2 (partial)
 * - Idempotent, logs JSON
 */

import { google } from 'googleapis'
import { BigQuery } from '@google-cloud/bigquery'
import pino from 'pino'
import { subDays, format } from 'date-fns'
import { zonedTimeToUtc } from 'date-fns-tz'

// ========================================
// Configuration
// ========================================

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
})

const config = {
  gcpProjectId: process.env.GCP_PROJECT_ID || 'moverz-dashboard',
  bqDataset: process.env.BQ_DATASET || 'analytics_core',
  bqTable: process.env.BQ_TABLE_NAME || 'gsc_daily_metrics',
  sitesList: process.env.SITES_LIST || '',
  fetchDays: parseInt(process.env.FETCH_DAYS || '3', 10),
  timezone: process.env.TIMEZONE || 'Europe/Paris',
  gcpSaKeyJson: process.env.GCP_SA_KEY_JSON || '',
}

// Validation config
if (!config.gcpSaKeyJson) {
  logger.error('GCP_SA_KEY_JSON is required')
  process.exit(1)
}

if (!config.sitesList) {
  logger.error('SITES_LIST is required')
  process.exit(1)
}

const sites = config.sitesList.split(',').map(s => s.trim()).filter(Boolean)

logger.info({
  config: {
    project: config.gcpProjectId,
    dataset: config.bqDataset,
    table: config.bqTable,
    sites: sites.length,
    fetchDays: config.fetchDays,
    timezone: config.timezone,
  }
}, 'Configuration loaded')

// ========================================
// Types
// ========================================

interface GSCRow {
  keys: string[] // [date, page?, query?]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface BQRow {
  date: string // YYYY-MM-DD
  domain: string
  page: string
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  ingested_at: string // ISO timestamp
}

interface DomainResult {
  domain: string
  success: boolean
  rowsInserted: number
  error?: string
  duration: number
}

// ========================================
// Clients
// ========================================

// Auth Google (Search Console + BigQuery)
let authClient: any
let searchConsole: any
let bigquery: BigQuery

async function initClients() {
  try {
    const credentials = JSON.parse(config.gcpSaKeyJson)
    
    // Google Auth
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/cloud-platform',
      ],
    })
    
    authClient = await auth.getClient()
    searchConsole = google.searchconsole({ version: 'v1', auth: authClient })
    
    // BigQuery
    bigquery = new BigQuery({
      projectId: config.gcpProjectId,
      credentials,
    })
    
    logger.info('Clients initialized successfully')
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to initialize clients')
    throw error
  }
}

// ========================================
// GSC Extraction
// ========================================

async function fetchGSCData(
  domain: string,
  startDate: string,
  endDate: string,
  retries = 3
): Promise<GSCRow[]> {
  const siteUrl = `sc-domain:${domain}`
  
  logger.info({ domain, startDate, endDate }, 'Fetching GSC data')
  
  try {
    const response = await searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date', 'page', 'query'], // 3 dimensions = max granularité
        rowLimit: 25000, // Max API
        dataState: 'final', // Données finales uniquement
      },
    })
    
    const rows: GSCRow[] = response.data.rows || []
    
    logger.info({ 
      domain, 
      rowCount: rows.length,
      hasMore: rows.length === 25000 
    }, 'GSC data fetched')
    
    if (rows.length === 25000) {
      logger.warn({ domain }, 'Hit API row limit (25k), consider splitting date range')
    }
    
    return rows
    
  } catch (error: any) {
    if (error.code === 429 && retries > 0) {
      const delay = (4 - retries) * 2000 // Exponential backoff
      logger.warn({ domain, retries, delay }, 'Rate limited, retrying...')
      await new Promise(resolve => setTimeout(resolve, delay))
      return fetchGSCData(domain, startDate, endDate, retries - 1)
    }
    
    logger.error({ 
      domain, 
      error: error.message, 
      code: error.code 
    }, 'Failed to fetch GSC data')
    
    throw error
  }
}

// ========================================
// Transformation
// ========================================

function transformRows(domain: string, gscRows: GSCRow[]): BQRow[] {
  const now = new Date().toISOString()
  
  return gscRows.map(row => {
    const [date, page, query] = row.keys
    
    // Sanity checks
    if (row.clicks > row.impressions) {
      logger.warn({ 
        domain, 
        date, 
        page, 
        query, 
        clicks: row.clicks, 
        impressions: row.impressions 
      }, 'Invalid data: clicks > impressions')
    }
    
    return {
      date,
      domain,
      page: page || '(unknown)',
      query: query || '(not set)',
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      ingested_at: now,
    }
  })
}

// ========================================
// BigQuery Upsert
// ========================================

async function upsertToBigQuery(rows: BQRow[]): Promise<number> {
  if (rows.length === 0) {
    logger.info('No rows to upsert')
    return 0
  }
  
  const tableRef = `${config.gcpProjectId}.${config.bqDataset}.${config.bqTable}`
  
  // MERGE statement (upsert sur clé composite)
  const mergeQuery = `
    MERGE \`${tableRef}\` T
    USING UNNEST(@rows) S
    ON T.date = S.date 
      AND T.domain = S.domain 
      AND T.page = S.page 
      AND T.query = S.query
    WHEN MATCHED THEN
      UPDATE SET
        clicks = S.clicks,
        impressions = S.impressions,
        ctr = S.ctr,
        position = S.position,
        ingested_at = S.ingested_at
    WHEN NOT MATCHED THEN
      INSERT (date, domain, page, query, clicks, impressions, ctr, position, ingested_at)
      VALUES (S.date, S.domain, S.page, S.query, S.clicks, S.impressions, S.ctr, S.position, S.ingested_at)
  `
  
  try {
    const [job] = await bigquery.createQueryJob({
      query: mergeQuery,
      params: { rows },
      types: {
        rows: [
          { name: 'date', type: 'DATE' },
          { name: 'domain', type: 'STRING' },
          { name: 'page', type: 'STRING' },
          { name: 'query', type: 'STRING' },
          { name: 'clicks', type: 'INT64' },
          { name: 'impressions', type: 'INT64' },
          { name: 'ctr', type: 'FLOAT64' },
          { name: 'position', type: 'FLOAT64' },
          { name: 'ingested_at', type: 'TIMESTAMP' },
        ],
      },
      location: 'europe-west1', // Must match dataset location
    })
    
    logger.info({ jobId: job.id }, 'BigQuery MERGE job started')
    
    const [results] = await job.getQueryResults()
    
    logger.info({ 
      jobId: job.id,
      rowsAffected: results.length 
    }, 'BigQuery MERGE completed')
    
    return rows.length
    
  } catch (error: any) {
    logger.error({ 
      error: error.message,
      tableRef 
    }, 'Failed to upsert to BigQuery')
    
    throw error
  }
}

// ========================================
// Main ETL Logic (par domaine)
// ========================================

async function processDomain(domain: string): Promise<DomainResult> {
  const startTime = Date.now()
  
  try {
    // Fenêtre de dates (GSC a ~48-72h de latence)
    const endDate = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const startDate = format(subDays(new Date(), config.fetchDays), 'yyyy-MM-dd')
    
    // 1. Extract
    const gscRows = await fetchGSCData(domain, startDate, endDate)
    
    // 2. Transform
    const bqRows = transformRows(domain, gscRows)
    
    // 3. Load (upsert)
    const rowsInserted = await upsertToBigQuery(bqRows)
    
    const duration = Date.now() - startTime
    
    logger.info({ 
      domain, 
      rowsInserted, 
      duration 
    }, 'Domain processed successfully')
    
    return {
      domain,
      success: true,
      rowsInserted,
      duration,
    }
    
  } catch (error: any) {
    const duration = Date.now() - startTime
    
    logger.error({ 
      domain, 
      error: error.message, 
      duration 
    }, 'Failed to process domain')
    
    return {
      domain,
      success: false,
      rowsInserted: 0,
      error: error.message,
      duration,
    }
  }
}

// ========================================
// Orchestration (tous les domaines)
// ========================================

async function runETL(): Promise<number> {
  const startTime = Date.now()
  
  logger.info({ sitesCount: sites.length }, 'Starting GSC ETL')
  
  // Initialiser clients
  await initClients()
  
  // Traiter chaque domaine séquentiellement (pour éviter rate limits)
  const results: DomainResult[] = []
  
  for (const domain of sites) {
    const result = await processDomain(domain)
    results.push(result)
  }
  
  // Résumé global
  const totalDuration = Date.now() - startTime
  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length
  const totalRows = results.reduce((sum, r) => sum + r.rowsInserted, 0)
  
  logger.info({
    totalDuration,
    sitesProcessed: results.length,
    successCount,
    failureCount,
    totalRows,
    results,
  }, 'ETL completed')
  
  // Codes de sortie
  if (failureCount === 0) {
    return 0 // Succès complet
  } else if (successCount > 0) {
    return 2 // Succès partiel
  } else {
    return 1 // Échec complet
  }
}

// ========================================
// CLI Entry Point
// ========================================

// Auto-run when executed directly (ES modules compatible)
runETL()
  .then(exitCode => {
    logger.info({ exitCode }, 'ETL finished')
    process.exit(exitCode)
  })
  .catch(error => {
    logger.fatal({ error: error.message }, 'ETL crashed')
    process.exit(1)
  })

export { runETL, processDomain }

