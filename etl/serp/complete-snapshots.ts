/**
 * ETL Complétion Snapshots Métadonnées SERP (j+2)
 * 
 * Complète les snapshots "pending" avec les données GSC disponibles j+2
 * - Récupère les snapshots pending pour date-2
 * - Récupère les données GSC pour cette date (maintenant disponibles)
 * - Met à jour les snapshots avec impressions/clics/ctr/position
 * - Change status de 'pending' à 'complete'
 * 
 * Codes sortie: 0 (success), 1 (error)
 */

import { BigQuery } from '@google-cloud/bigquery'
import pino from 'pino'
import { format, subDays } from 'date-fns'

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
  gcpSaKeyJson: process.env.GCP_SA_KEY_JSON || '',
}

// Validation config
if (!config.gcpSaKeyJson) {
  logger.error('GCP_SA_KEY_JSON is required')
  process.exit(1)
}

const credentials = JSON.parse(config.gcpSaKeyJson)
const bigquery = new BigQuery({
  projectId: config.gcpProjectId,
  credentials,
})

const BQ_LOCATION = process.env.BQ_LOCATION || 'europe-west1'

// ========================================
// Récupérer Snapshots Pending
// ========================================

async function getPendingSnapshots(targetDate: string): Promise<Array<{
  snapshot_date: string
  url: string
  metadata_date: string
}>> {
  const query = `
    SELECT DISTINCT
      snapshot_date,
      url,
      metadata_date
    FROM \`${config.gcpProjectId}.${config.bqDataset}.serp_metadata_snapshots\`
    WHERE snapshot_date = @target_date
      AND status = 'pending'
      AND gsc_date IS NULL
    ORDER BY url
  `
  
  try {
    const [rows] = await bigquery.query({
      query,
      location: BQ_LOCATION,
      params: { target_date: targetDate },
    })
    
    return rows as Array<{ snapshot_date: string; url: string; metadata_date: string }>
  } catch (error: any) {
    logger.error('Failed to fetch pending snapshots:', error)
    throw error
  }
}

// ========================================
// Récupérer Données GSC par URL
// ========================================

async function getGSCDataForURLs(urls: string[], gscDate: string): Promise<Map<string, {
  impressions: number
  clicks: number
  ctr: number
  position: number
}>> {
  if (urls.length === 0) return new Map()
  
  // Extraire les domaines des URLs
  const urlMap = new Map<string, string>() // url -> domain
  urls.forEach(url => {
    try {
      const domain = new URL(url).hostname.replace('www.', '')
      urlMap.set(url, domain)
    } catch {
      // Ignore invalid URLs
    }
  })
  
  const domains = Array.from(new Set(urlMap.values()))
  const urlList = Array.from(urlMap.keys())
  
  // Requête GSC pour récupérer les données par page
  const query = `
    SELECT 
      page as url,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr,
      AVG(position) as position
    FROM \`${config.gcpProjectId}.${config.bqDataset}.gsc_daily_metrics\`
    WHERE date = @gsc_date
      AND page IN UNNEST(@urls)
    GROUP BY page
  `
  
  try {
    const [rows] = await bigquery.query({
      query,
      location: BQ_LOCATION,
      params: {
        gsc_date: gscDate,
        urls: urlList,
      },
    })
    
    const result = new Map<string, {
      impressions: number
      clicks: number
      ctr: number
      position: number
    }>()
    
    for (const row of rows as Array<{
      url: string
      impressions: number
      clicks: number
      ctr: number
      position: number
    }>) {
      result.set(row.url, {
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        ctr: Number(row.ctr) || 0,
        position: Number(row.position) || 0,
      })
    }
    
    return result
  } catch (error: any) {
    logger.error('Failed to fetch GSC data:', error)
    throw error
  }
}

// ========================================
// Compléter Snapshots
// ========================================

async function completePendingSnapshots(targetDate: string): Promise<{
  completed: number
  notFound: number
  errors: string[]
}> {
  logger.info(`Completing snapshots for ${targetDate}`)
  
  // 1. Récupérer snapshots pending
  const pendingSnapshots = await getPendingSnapshots(targetDate)
  logger.info(`Found ${pendingSnapshots.length} pending snapshots`)
  
  if (pendingSnapshots.length === 0) {
    logger.info('No pending snapshots to complete')
    return { completed: 0, notFound: 0, errors: [] }
  }
  
  // 2. Récupérer données GSC pour metadata_date (j+2 maintenant disponible)
  const urls = pendingSnapshots.map(s => s.url)
  const gscDataMap = await getGSCDataForURLs(urls, targetDate)
  
  logger.info(`Found GSC data for ${gscDataMap.size}/${urls.length} URLs`)
  
  // 3. Préparer les mises à jour
  const updates: Array<{
    snapshot_date: string
    url: string
    gsc_date: string
    impressions: number | null
    clicks: number | null
    ctr: number | null
    position: number | null
    status: string
  }> = []
  
  const notFound: string[] = []
  
  for (const snapshot of pendingSnapshots) {
    const gscData = gscDataMap.get(snapshot.url)
    
    if (gscData) {
      updates.push({
        snapshot_date: snapshot.snapshot_date,
        url: snapshot.url,
        gsc_date: snapshot.metadata_date, // Date des métadonnées = date des performances
        impressions: gscData.impressions,
        clicks: gscData.clicks,
        ctr: gscData.ctr,
        position: gscData.position,
        status: 'complete',
      })
    } else {
      // Pas de données GSC trouvées (peut être normal si page n'a pas d'impressions ce jour-là)
      updates.push({
        snapshot_date: snapshot.snapshot_date,
        url: snapshot.url,
        gsc_date: snapshot.metadata_date,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        position: null,
        status: 'complete', // On marque comme complete même avec 0 (c'est une donnée valide)
      })
      notFound.push(snapshot.url)
    }
  }
  
  // 4. Mettre à jour dans BigQuery
  if (updates.length > 0) {
    const updateQuery = `
      UPDATE \`${config.gcpProjectId}.${config.bqDataset}.serp_metadata_snapshots\` AS target
      SET
        gsc_date = source.gsc_date,
        impressions = source.impressions,
        clicks = source.clicks,
        ctr = source.ctr,
        position = source.position,
        status = source.status,
        updated_at = CURRENT_TIMESTAMP()
      FROM UNNEST(@updates) AS source
      WHERE target.snapshot_date = source.snapshot_date
        AND target.url = source.url
    `
    
    try {
      await bigquery.query({
        query: updateQuery,
        location: BQ_LOCATION,
        params: { updates },
      })
      logger.info(`✅ Completed ${updates.length} snapshots`)
    } catch (error: any) {
      logger.error('Failed to update snapshots:', error)
      throw error
    }
  }
  
  return {
    completed: updates.length,
    notFound: notFound.length,
    errors: [],
  }
}

// ========================================
// Main
// ========================================

async function main() {
  // Compléter les snapshots de j-2 (données maintenant disponibles)
  const targetDate = format(subDays(new Date(), 2), 'yyyy-MM-dd')
  
  try {
    const result = await completePendingSnapshots(targetDate)
    
    logger.info('Completion finished', {
      date: targetDate,
      completed: result.completed,
      notFound: result.notFound,
    })
    
    process.exit(0)
  } catch (error: any) {
    logger.error('Completion failed:', error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

