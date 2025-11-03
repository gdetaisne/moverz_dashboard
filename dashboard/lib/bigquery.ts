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
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
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
        AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
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
      AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
      ${siteFilter}
    GROUP BY date, domain
    ORDER BY date DESC, domain
  `
  
  const [rows] = await bigquery.query({ query })
  return rows as GSCGlobalMetrics[]
}

export async function getTopPages(site?: string, limit: number = 20) {
  // Try 1: prefer the materialized view gsc_pages_summary if present
  const siteFilter = site ? `WHERE domain = @site` : ''
  const queryView = `
    SELECT 
      domain as domain,
      page as page,
      clicks as clicks,
      impressions as impressions,
      ctr as ctr,
      avg_position as position
    FROM \`${projectId}.${dataset}.gsc_pages_summary\`
    ${siteFilter}
    ORDER BY impressions DESC
    LIMIT @limit
  `

  try {
    const paramsView: Record<string, any> = { limit }
    if (site) paramsView.site = site
    const [rows] = await bigquery.query({ query: queryView, params: paramsView })
    return rows as unknown as GSCPageMetrics[]
  } catch (e: any) {
    // Fallback: compute from gsc_daily_metrics (30 days)
    const queryFallback = `
      WITH recent_data AS (
        SELECT 
          domain,
          page,
          SUM(clicks) AS clicks,
          SUM(impressions) AS impressions,
          SAFE_DIVIDE(SUM(clicks), SUM(impressions)) AS ctr,
          AVG(position) AS position
        FROM \`${projectId}.${dataset}.gsc_daily_metrics\`
        WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
          AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
          ${site ? 'AND domain = @site' : ''}
        GROUP BY domain, page
      )
      SELECT *
      FROM recent_data
      ORDER BY impressions DESC
      LIMIT @limit
    `
    const paramsFallback: Record<string, any> = { limit }
    if (site) paramsFallback.site = site
    const [rows] = await bigquery.query({ query: queryFallback, params: paramsFallback })
    return rows as unknown as GSCPageMetrics[]
  }
}

export async function getTotalImpressionsLast30Days(): Promise<number> {
  const query = `
    SELECT SUM(impressions) AS total_impressions
    FROM \`${projectId}.${dataset}.gsc_daily_metrics\`
    WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
  `
  const [rows] = await bigquery.query({ query })
  const total = (rows?.[0]?.total_impressions as number) || 0
  return Number(total) || 0
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
  // Utiliser table.insert() directement au lieu d'INSERT avec paramètres
  // BigQuery convertit automatiquement les objets JS en JSON quand on utilise table.insert()
  const table = bigquery.dataset(dataset).table('errors_404_history')
  
  const row = {
    id: entry.id,
    scan_date: entry.scan_date, // ISO string sera converti en TIMESTAMP automatiquement
    total_sites: entry.total_sites,
    total_pages_checked: entry.total_pages_checked,
    total_errors_404: entry.total_errors_404,
    sites_results: entry.sites_results, // Objet JS - BigQuery le convertit en JSON automatiquement
    crawl_duration_seconds: entry.crawl_duration_seconds,
  }
  
  try {
    await table.insert([row])
    console.log(`[BigQuery insertError404History] ✅ Inserted scan ${entry.id}`)
  } catch (error: any) {
    console.error('[BigQuery insertError404History] Error:', error)
    console.error('[BigQuery insertError404History] Entry:', {
      id: entry.id,
      scan_date: entry.scan_date,
      total_sites: entry.total_sites,
      total_pages_checked: entry.total_pages_checked,
      total_errors_404: entry.total_errors_404,
    })
    throw error // Re-lancer pour que le catch du crawl route puisse logger
  }
}

export async function getError404Evolution(days: number = 30): Promise<Error404Evolution[]> {
  try {
    console.log(`[BigQuery getError404Evolution] Querying with days=${days}`)
    
    const query = `
      SELECT 
        FORMAT_TIMESTAMP('%Y-%m-%dT00:00:00', TIMESTAMP(DATE(scan_date))) as date,
        COUNT(*) as nb_scans,
        CAST(AVG(total_pages_checked) AS INT64) as avg_pages_checked,
        CAST(AVG(total_errors_404) AS INT64) as avg_errors_404,
        CAST(MAX(total_errors_404) AS INT64) as max_errors_404,
        CAST(MIN(total_errors_404) AS INT64) as min_errors_404,
        CAST(AVG(crawl_duration_seconds) AS INT64) as avg_duration_seconds
      FROM \`${projectId}.${dataset}.errors_404_history\`
      WHERE scan_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
      GROUP BY DATE(scan_date), FORMAT_TIMESTAMP('%Y-%m-%dT00:00:00', TIMESTAMP(DATE(scan_date)))
      ORDER BY date DESC
    `
    
    console.log(`[BigQuery getError404Evolution] Executing query on ${projectId}.${dataset}.errors_404_history`)
    const [rows] = await bigquery.query({ query })
    console.log(`[BigQuery getError404Evolution] Query returned ${rows?.length || 0} rows`)
    
    // Convertir les résultats avec types corrects
    const results = (rows || []).map(row => ({
      date: String(row.date || ''),
      nb_scans: Number(row.nb_scans || 0),
      avg_pages_checked: Number(row.avg_pages_checked || 0),
      avg_errors_404: Number(row.avg_errors_404 || 0),
      max_errors_404: Number(row.max_errors_404 || 0),
      min_errors_404: Number(row.min_errors_404 || 0),
      avg_duration_seconds: Number(row.avg_duration_seconds || 0),
    }))
    
    console.log(`[BigQuery getError404Evolution] Converted ${results.length} results`, results.length > 0 ? results[0] : 'no data')
    return results
  } catch (error: any) {
    console.error(`[BigQuery getError404Evolution] Error:`, error)
    console.error(`[BigQuery getError404Evolution] Stack:`, error.stack)
    throw error
  }
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

// ========================================
// Errors 404 URLs & Broken Links
// ========================================

export interface Error404UrlEntry {
  site: string
  path: string
  status: '404' | '410'
}

export interface Error404UrlScan {
  scan_id: string
  scan_date: string
  commit_sha?: string
  branch?: string
  actor?: string
  repo?: string
  entries: Error404UrlEntry[]
}

export async function insertError404UrlsScan(scan: Error404UrlScan) {
  if (scan.entries.length === 0) return
  
  const query = `
    INSERT INTO \`${projectId}.${dataset}.errors_404_urls\`
    (scan_id, scan_date, site, path, status, commit_sha, branch, actor, repo)
    SELECT 
      @scan_id,
      @scan_date,
      entry.site,
      entry.path,
      entry.status,
      @commit_sha,
      @branch,
      @actor,
      @repo
    FROM UNNEST(@entries) as entry
  `
  
  await bigquery.query({
    query,
    params: {
      scan_id: scan.scan_id,
      scan_date: scan.scan_date,
      entries: scan.entries,
      commit_sha: scan.commit_sha || null,
      branch: scan.branch || null,
      actor: scan.actor || null,
      repo: scan.repo || null,
    },
  })
}

export interface BrokenLinksScan {
  scan_id: string
  scan_date: string
  commit_sha?: string
  branch?: string
  actor?: string
  repo?: string
  links: Array<{
    site: string
    source: string
    target: string
  }>
}

export async function insertBrokenLinksScan(scan: BrokenLinksScan) {
  if (scan.links.length === 0) return
  
  const query = `
    INSERT INTO \`${projectId}.${dataset}.broken_links\`
    (scan_id, scan_date, site, source_url, target_url, commit_sha, branch, actor, repo)
    SELECT 
      @scan_id,
      @scan_date,
      link.site,
      link.source,
      link.target,
      @commit_sha,
      @branch,
      @actor,
      @repo
    FROM UNNEST(@links) as link
  `
  
  await bigquery.query({
    query,
    params: {
      scan_id: scan.scan_id,
      scan_date: scan.scan_date,
      links: scan.links,
      commit_sha: scan.commit_sha || null,
      branch: scan.branch || null,
      actor: scan.actor || null,
      repo: scan.repo || null,
    },
  })
}

// ========================================
// Deltas (comparaisons entre scans)
// ========================================

export interface DeltaItem {
  site: string
  path: string
}

export interface Error404DeltaResult {
  from_scan_id: string
  to_scan_id: string
  gained: DeltaItem[]
  lost: DeltaItem[]
  persisting: number
  by_site: Array<{
    site: string
    gained: number
    lost: number
    persisting: number
  }>
}

export async function getError404Delta(params: { from?: string; to?: string }): Promise<Error404DeltaResult | null> {
  // Récupérer les 2 derniers scans
  const scanQuery = `
    SELECT DISTINCT scan_id, scan_date
    FROM \`${projectId}.${dataset}.errors_404_urls\`
    ORDER BY scan_date DESC
    LIMIT 2
  `
  
  const [scans] = await bigquery.query({ query: scanQuery })
  if (scans.length < 2) return null
  
  const toScanId = params.to || scans[0].scan_id
  const fromScanId = params.from || scans[1].scan_id
  
  // Calculer gained, lost, persisting
  const deltaQuery = `
    WITH from_data AS (
      SELECT site, path
      FROM \`${projectId}.${dataset}.errors_404_urls\`
      WHERE scan_id = @from_scan_id
    ),
    to_data AS (
      SELECT site, path
      FROM \`${projectId}.${dataset}.errors_404_urls\`
      WHERE scan_id = @to_scan_id
    ),
    gained AS (
      SELECT t.site, t.path
      FROM to_data t
      LEFT JOIN from_data f ON t.site = f.site AND t.path = f.path
      WHERE f.site IS NULL
    ),
    lost AS (
      SELECT f.site, f.path
      FROM from_data f
      LEFT JOIN to_data t ON f.site = t.site AND f.path = t.path
      WHERE t.site IS NULL
    ),
    persisting AS (
      SELECT COUNT(*) as count
      FROM to_data t
      JOIN from_data f ON t.site = f.site AND t.path = f.path
    ),
    by_site AS (
      SELECT 
        site,
        COUNT(DISTINCT CASE WHEN t.site IS NOT NULL AND f.site IS NULL THEN CONCAT(t.site, '|', t.path) END) as gained,
        COUNT(DISTINCT CASE WHEN f.site IS NOT NULL AND t.site IS NULL THEN CONCAT(f.site, '|', f.path) END) as lost,
        COUNT(DISTINCT CASE WHEN t.site IS NOT NULL AND f.site IS NOT NULL THEN CONCAT(t.site, '|', t.path) END) as persisting
      FROM (
        SELECT site, path FROM from_data
        UNION DISTINCT
        SELECT site, path FROM to_data
      ) all_data
      LEFT JOIN from_data f ON all_data.site = f.site AND all_data.path = f.path
      LEFT JOIN to_data t ON all_data.site = t.site AND all_data.path = t.path
      GROUP BY site
    )
    SELECT 
      @from_scan_id as from_scan_id,
      @to_scan_id as to_scan_id,
      ARRAY_AGG(STRUCT(g.site, g.path) ORDER BY g.site, g.path) as gained,
      ARRAY_AGG(STRUCT(l.site, l.path) ORDER BY l.site, l.path) as lost,
      (SELECT count FROM persisting) as persisting,
      ARRAY_AGG(STRUCT(bs.site, bs.gained, bs.lost, bs.persisting) ORDER BY bs.site) as by_site
    FROM gained g, lost l, by_site bs
  `
  
  const [rows] = await bigquery.query({
    query: deltaQuery,
    params: { from_scan_id: fromScanId, to_scan_id: toScanId },
  })
  
  return rows[0] as Error404DeltaResult
}

export interface BrokenLinksDeltaItem {
  site: string
  path: string
}

export interface BrokenLinksDeltaResult {
  from_scan_id: string
  to_scan_id: string
  gained: BrokenLinksDeltaItem[]
  lost: BrokenLinksDeltaItem[]
  persisting: number
  by_site: Array<{ site: string; gained: number; lost: number; persisting: number }>
}

export async function getBrokenLinksDelta(params: { from?: string; to?: string }): Promise<BrokenLinksDeltaResult | null> {
  // Similaire à getError404Delta mais sur table broken_links
  const scanQuery = `
    SELECT DISTINCT scan_id, scan_date
    FROM \`${projectId}.${dataset}.broken_links\`
    ORDER BY scan_date DESC
    LIMIT 2
  `
  
  const [scans] = await bigquery.query({ query: scanQuery })
  if (scans.length < 2) return null
  
  const toScanId = params.to || scans[0].scan_id
  const fromScanId = params.from || scans[1].scan_id
  
  const deltaQuery = `
    WITH from_data AS (
      SELECT site, target_url
      FROM \`${projectId}.${dataset}.broken_links\`
      WHERE scan_id = @from_scan_id
    ),
    to_data AS (
      SELECT site, target_url
      FROM \`${projectId}.${dataset}.broken_links\`
      WHERE scan_id = @to_scan_id
    ),
    gained AS (
      SELECT t.site, NET.REG_DOMAIN(t.target_url) as domain, REGEXP_EXTRACT(t.target_url, r'[^?]*') as path
      FROM to_data t
      LEFT JOIN from_data f ON t.site = f.site AND t.target_url = f.target_url
      WHERE f.site IS NULL
    ),
    lost AS (
      SELECT f.site, NET.REG_DOMAIN(f.target_url) as domain, REGEXP_EXTRACT(f.target_url, r'[^?]*') as path
      FROM from_data f
      LEFT JOIN to_data t ON f.site = t.site AND f.target_url = t.target_url
      WHERE t.site IS NULL
    ),
    persisting AS (
      SELECT COUNT(*) as count
      FROM to_data t
      JOIN from_data f ON t.site = f.site AND t.target_url = f.target_url
    ),
    by_site AS (
      SELECT 
        site,
        COUNT(DISTINCT CASE WHEN t.site IS NOT NULL AND f.site IS NULL THEN CONCAT(t.site, '|', t.target_url) END) as gained,
        COUNT(DISTINCT CASE WHEN f.site IS NOT NULL AND t.site IS NULL THEN CONCAT(f.site, '|', f.target_url) END) as lost,
        COUNT(DISTINCT CASE WHEN t.site IS NOT NULL AND f.site IS NOT NULL THEN CONCAT(t.site, '|', t.target_url) END) as persisting
      FROM (
        SELECT site, target_url FROM from_data
        UNION DISTINCT
        SELECT site, target_url FROM to_data
      ) all_data
      LEFT JOIN from_data f ON all_data.site = f.site AND all_data.target_url = f.target_url
      LEFT JOIN to_data t ON all_data.site = t.site AND all_data.target_url = t.target_url
      GROUP BY site
    )
    SELECT 
      @from_scan_id as from_scan_id,
      @to_scan_id as to_scan_id,
      ARRAY_AGG(STRUCT(g.site, REGEXP_EXTRACT(g.path, r'/(.*)') as path) ORDER BY g.site, g.path LIMIT 1000) as gained,
      ARRAY_AGG(STRUCT(l.site, REGEXP_EXTRACT(l.path, r'/(.*)') as path) ORDER BY l.site, l.path LIMIT 1000) as lost,
      (SELECT count FROM persisting) as persisting,
      ARRAY_AGG(STRUCT(bs.site, bs.gained, bs.lost, bs.persisting) ORDER BY bs.site) as by_site
    FROM gained g, lost l, by_site bs
  `
  
  const [rows] = await bigquery.query({
    query: deltaQuery,
    params: { from_scan_id: fromScanId, to_scan_id: toScanId },
  })
  
  return rows[0] as BrokenLinksDeltaResult
}

// ========================================
// Reconstructed Scans & Evolution
// ========================================

export interface ReconstructedSiteScan {
  site: string
  total_checked: number
  errors_404: number
  errors_list: string[]
  broken_links: number
  broken_links_list: Array<{ source: string; target: string }>
  scan_date: string
}

export interface ReconstructedScanResponse {
  scan_id: string
  scan_date: string
  results: ReconstructedSiteScan[]
  summary: {
    total_sites: number
    total_checked: number
    total_errors: number
  }
}

export async function getLastReconstructedScan(): Promise<ReconstructedScanResponse | null> {
  // Récupérer le dernier scan
  const lastScan = await getLastError404Scan()
  if (!lastScan) return null
  
  // Récupérer URLs et liens cassés pour ce scan
  const detailQuery = `
    WITH urls AS (
      SELECT site, path
      FROM \`${projectId}.${dataset}.errors_404_urls\`
      WHERE scan_id = @scan_id
    ),
    links AS (
      SELECT site, source_url, target_url
      FROM \`${projectId}.${dataset}.broken_links\`
      WHERE scan_id = @scan_id
    )
    SELECT 
      COALESCE((SELECT ARRAY_AGG(STRUCT(site, path) ORDER BY site, path LIMIT 1000) FROM urls), []) as urls,
      COALESCE((SELECT ARRAY_AGG(STRUCT(site, source_url as source, target_url as target) ORDER BY site, source_url LIMIT 1000) FROM links), []) as links
  `
  
  const [detailRows] = await bigquery.query({
    query: detailQuery,
    params: { scan_id: lastScan.id },
  })
  
  const details = detailRows[0] as { urls: Array<{ site: string; path: string }>, links: Array<{ site: string; source: string; target: string }> }
  
  // Reconstruire les résultats par site
  const results: ReconstructedSiteScan[] = (lastScan.sites_results as any[]).map(siteResult => ({
    site: siteResult.site,
    total_checked: siteResult.total_checked,
    errors_404: siteResult.errors_404,
    errors_list: (details.urls || []).filter((u: any) => u.site === siteResult.site).map((u: any) => u.path),
    broken_links: (details.links || []).filter((l: any) => l.site === siteResult.site).length,
    broken_links_list: (details.links || []).filter((l: any) => l.site === siteResult.site).map((l: any) => ({ source: l.source, target: l.target })),
    scan_date: lastScan.scan_date,
  }))
  
  return {
    scan_id: lastScan.id,
    scan_date: lastScan.scan_date,
    results,
    summary: {
      total_sites: lastScan.total_sites,
      total_checked: lastScan.total_pages_checked,
      total_errors: lastScan.total_errors_404,
    },
  }
}

export async function getLastScansAsEvolution(limit: number = 20): Promise<Error404Evolution[]> {
  try {
    console.log(`[BigQuery getLastScansAsEvolution] Querying with limit=${limit}`)
    
    const query = `
      SELECT 
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S', scan_date) as date,
        1 as nb_scans,
        CAST(total_pages_checked AS INT64) as avg_pages_checked,
        CAST(total_errors_404 AS INT64) as avg_errors_404,
        CAST(total_errors_404 AS INT64) as max_errors_404,
        CAST(total_errors_404 AS INT64) as min_errors_404,
        CAST(crawl_duration_seconds AS INT64) as avg_duration_seconds
      FROM \`${projectId}.${dataset}.errors_404_history\`
      ORDER BY scan_date DESC
      LIMIT @limit
    `
    
    console.log(`[BigQuery getLastScansAsEvolution] Executing query on ${projectId}.${dataset}.errors_404_history`)
    const [rows] = await bigquery.query({
      query,
      params: { limit },
    })
    console.log(`[BigQuery getLastScansAsEvolution] Query returned ${rows?.length || 0} rows`)
    
    // Convertir les résultats et inverser l'ordre (plus ancien en premier)
    const results = (rows || []).map(row => ({
      date: String(row.date || ''),
      nb_scans: Number(row.nb_scans || 1),
      avg_pages_checked: Number(row.avg_pages_checked || 0),
      avg_errors_404: Number(row.avg_errors_404 || 0),
      max_errors_404: Number(row.max_errors_404 || 0),
      min_errors_404: Number(row.min_errors_404 || 0),
      avg_duration_seconds: Number(row.avg_duration_seconds || 0),
    }))
    
    console.log(`[BigQuery getLastScansAsEvolution] Converted ${results.length} results`, results.length > 0 ? results[0] : 'no data')
    return results.reverse()
  } catch (error: any) {
    console.error(`[BigQuery getLastScansAsEvolution] Error:`, error)
    console.error(`[BigQuery getLastScansAsEvolution] Stack:`, error.stack)
    throw error
  }
}

