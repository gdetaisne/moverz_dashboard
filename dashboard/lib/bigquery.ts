import { BigQuery } from '@google-cloud/bigquery'

const projectId = process.env.GCP_PROJECT_ID || 'moverz-dashboard'
const dataset = process.env.BQ_DATASET || 'analytics_core'

// Parse credentials depuis env var
let credentials: any
try {
  if (process.env.GCP_SA_KEY_JSON) {
    credentials = JSON.parse(process.env.GCP_SA_KEY_JSON)
  }
} catch (error) {
  console.error('Failed to parse GCP_SA_KEY_JSON:', error)
}

export const bigquery = new BigQuery({
  projectId,
  credentials,
})

// Types
export interface GSCGlobalMetrics {
  date: string
  domain: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GSCPageMetrics extends GSCGlobalMetrics {
  page: string
}

export interface GSCQueryMetrics extends GSCGlobalMetrics {
  query: string
}

export interface SiteMetrics {
  site: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  trend_clicks: number
  trend_impressions: number
}

// Queries
export async function getGlobalMetrics(days: number = 7): Promise<SiteMetrics[]> {
  const query = `
    WITH current_period AS (
      SELECT 
        domain as site,
        SUM(clicks) as clicks,
        SUM(impressions) as impressions,
        AVG(ctr) as ctr,
        AVG(position) as position
      FROM \`${projectId}.${dataset}.gsc_daily_aggregated\`
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
      GROUP BY domain
    ),
    previous_period AS (
      SELECT 
        domain as site,
        SUM(clicks) as prev_clicks,
        SUM(impressions) as prev_impressions
      FROM \`${projectId}.${dataset}.gsc_daily_aggregated\`
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days * 2} DAY)
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
      GROUP BY domain
    )
    SELECT 
      c.site,
      c.clicks,
      c.impressions,
      c.ctr,
      c.position,
      SAFE_DIVIDE(c.clicks - COALESCE(p.prev_clicks, 0), COALESCE(p.prev_clicks, 1)) * 100 as trend_clicks,
      SAFE_DIVIDE(c.impressions - COALESCE(p.prev_impressions, 0), COALESCE(p.prev_impressions, 1)) * 100 as trend_impressions
    FROM current_period c
    LEFT JOIN previous_period p ON c.site = p.site
    ORDER BY c.impressions DESC
  `
  
  const [rows] = await bigquery.query({ query })
  return rows as SiteMetrics[]
}

export async function getTimeSeriesData(site?: string, days: number = 30) {
  const siteFilter = site ? `AND domain = '${site}'` : ''
  
  const query = `
    SELECT 
      FORMAT_DATE('%Y-%m-%d', date) as date,
      domain as site,
      SUM(clicks) as clicks,
      SUM(impressions) as impressions,
      AVG(ctr) as ctr,
      AVG(position) as position
    FROM \`${projectId}.${dataset}.gsc_daily_aggregated\`
    WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
      ${siteFilter}
    GROUP BY date, domain
    ORDER BY date DESC, domain
  `
  
  const [rows] = await bigquery.query({ query })
  return rows as GSCGlobalMetrics[]
}

export async function getTopPages(site?: string, limit: number = 20) {
  // NOTE: La dimension "page" n'est plus collectée dans gsc_daily_aggregated
  // pour éviter le filtrage des clics par Google (privacy threshold)
  // Retourne un tableau vide pour l'instant
  return [] as GSCPageMetrics[]
}

export async function getTopQueries(site?: string, limit: number = 20) {
  // NOTE: La dimension "query" n'est plus collectée dans gsc_daily_aggregated
  // pour éviter le filtrage des clics par Google (privacy threshold)
  // Retourne un tableau vide pour l'instant
  return [] as GSCQueryMetrics[]
}

// ========================================
// Errors 404 History
// ========================================

export interface Error404HistoryEntry {
  id: string
  scan_date: string
  total_sites: number
  total_pages_checked: number
  total_errors_404: number
  sites_results: Array<{
    site: string
    total_checked: number
    errors_404: number
  }>
  crawl_duration_seconds: number
  created_at: string
}

export interface Error404Evolution {
  date: string
  nb_scans: number
  avg_pages_checked: number
  avg_errors_404: number
  max_errors_404: number
  min_errors_404: number
  avg_duration_seconds: number
}

export async function insertError404History(entry: Omit<Error404HistoryEntry, 'created_at'>) {
  const query = `
    INSERT INTO \`${projectId}.${dataset}.errors_404_history\` (
      id, scan_date, total_sites, total_pages_checked, total_errors_404,
      sites_results, crawl_duration_seconds
    )
    VALUES (
      @id, @scan_date, @total_sites, @total_pages_checked, @total_errors_404,
      @sites_results, @crawl_duration_seconds
    )
  `
  
  const options = {
    query,
    params: {
      id: entry.id,
      scan_date: entry.scan_date,
      total_sites: entry.total_sites,
      total_pages_checked: entry.total_pages_checked,
      total_errors_404: entry.total_errors_404,
      sites_results: JSON.stringify(entry.sites_results),
      crawl_duration_seconds: entry.crawl_duration_seconds,
    },
  }
  
  await bigquery.query(options)
}

export async function getError404Evolution(days: number = 30): Promise<Error404Evolution[]> {
  const query = `
    SELECT 
      DATE(scan_date) as date,
      COUNT(*) as nb_scans,
      AVG(total_pages_checked) as avg_pages_checked,
      AVG(total_errors_404) as avg_errors_404,
      MAX(total_errors_404) as max_errors_404,
      MIN(total_errors_404) as min_errors_404,
      AVG(crawl_duration_seconds) as avg_duration_seconds
    FROM \`${projectId}.${dataset}.errors_404_history\`
    WHERE scan_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
    GROUP BY DATE(scan_date)
    ORDER BY date DESC
  `
  
  const [rows] = await bigquery.query({ query })
  return rows as Error404Evolution[]
}

export async function getLastError404Scan(): Promise<Error404HistoryEntry | null> {
  const query = `
    SELECT 
      id,
      scan_date,
      total_sites,
      total_pages_checked,
      total_errors_404,
      sites_results,
      crawl_duration_seconds,
      created_at
    FROM \`${projectId}.${dataset}.errors_404_history\`
    WHERE scan_date = (
      SELECT MAX(scan_date) 
      FROM \`${projectId}.${dataset}.errors_404_history\`
    )
    LIMIT 1
  `
  
  const [rows] = await bigquery.query({ query })
  return rows.length > 0 ? rows[0] as Error404HistoryEntry : null
}

