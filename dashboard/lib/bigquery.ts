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

