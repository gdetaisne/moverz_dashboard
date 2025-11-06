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

export const bigquery = new BigQuery(
  credentials
    ? { projectId, credentials }
    : {
        projectId,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      }
)

export function hasBigQueryCredentials(): boolean {
  return Boolean(process.env.GCP_SA_KEY_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS)
}

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
  // Try 1: prefer the materialized view gsc_pages_summary if present
  const siteFilter = site ? `WHERE domain = @site` : ''
  const limitClauseView = (typeof limit === 'number' && limit > 0) ? 'LIMIT @limit' : ''
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
    ${limitClauseView}
  `

  try {
    const paramsView: Record<string, any> = {}
    if (typeof limit === 'number' && limit > 0) paramsView.limit = limit
    if (site) paramsView.site = site
    const [rows] = await bigquery.query({ query: queryView, params: paramsView })
    return rows as unknown as GSCPageMetrics[]
  } catch (e: any) {
    // Fallback: compute from gsc_daily_metrics (30 days)
    const limitClauseFallback = (typeof limit === 'number' && limit > 0) ? 'LIMIT @limit' : ''
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
          ${site ? 'AND domain = @site' : ''}
        GROUP BY domain, page
      )
      SELECT *
      FROM recent_data
      ORDER BY impressions DESC
      ${limitClauseFallback}
    `
    const paramsFallback: Record<string, any> = {}
    if (typeof limit === 'number' && limit > 0) paramsFallback.limit = limit
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
  avg_broken_links: number // Nombre moyen de liens cassés visibles
  avg_duration_seconds: number
}

export async function insertError404History(entry: Omit<Error404HistoryEntry, 'created_at'>) {
  // Utiliser table.insert() qui gère mieux les conversions de types automatiquement
  // BigQuery convertit automatiquement les objets JS en JSON et les Date en TIMESTAMP
  const table = bigquery.dataset(dataset).table('errors_404_history')
  
  const row = {
    id: entry.id,
    scan_date: new Date(entry.scan_date), // Date object → TIMESTAMP automatique
    total_sites: Number(entry.total_sites) || 0,
    total_pages_checked: Number(entry.total_pages_checked) || 0,
    total_errors_404: Number(entry.total_errors_404) || 0,
    // IMPORTANT: Stringifier le tableau pour éviter l'erreur "Array specified for non-repeated field"
    // table.insert() interprète les tableaux JS comme des champs répétés (ARRAY)
    // Pour une colonne JSON, il faut passer une STRING JSON, pas un tableau JS
    sites_results: JSON.stringify(entry.sites_results),
    crawl_duration_seconds: Number(entry.crawl_duration_seconds) || 0,
  }
  
  try {
    await table.insert([row])
    console.log(`[BigQuery insertError404History] ✅ Inserted scan ${entry.id}`)
  } catch (error: any) {
    // BigQuery peut retourner des erreurs dans error.errors[] au lieu de error.message
    const errorMessage = error.message || error.toString() || 'Unknown error'
    const errorDetails = error.errors || error.response?.errors || []
    
    console.error('[BigQuery insertError404History] Error:', error)
    console.error('[BigQuery insertError404History] Error details:', {
      message: errorMessage,
      code: error.code,
      errors: errorDetails,
      response: error.response,
      stack: error.stack,
    })
    console.error('[BigQuery insertError404History] Row:', {
      id: row.id,
      scan_date: row.scan_date,
      total_sites: row.total_sites,
      total_pages_checked: row.total_pages_checked,
      total_errors_404: row.total_errors_404,
      sites_results_type: typeof row.sites_results,
      sites_results_length: Array.isArray(row.sites_results) ? row.sites_results.length : 'not array',
      crawl_duration_seconds: row.crawl_duration_seconds,
    })
    
    // Créer une erreur enrichie avec tous les détails disponibles
    const enrichedError = new Error(errorMessage)
    ;(enrichedError as any).code = error.code
    ;(enrichedError as any).errors = errorDetails
    ;(enrichedError as any).originalError = error
    throw enrichedError
  }
}

export async function getError404Evolution(days: number = 30): Promise<Error404Evolution[]> {
  if (!hasBigQueryCredentials()) {
    console.warn('[BigQuery getError404Evolution] No credentials in dev → returning empty evolution')
    return []
  }
  try {
    console.log(`[BigQuery getError404Evolution] Querying with days=${days}`)
    
    // Joindre avec broken_links pour compter les liens cassés par jour
    const query = `
      WITH daily_scans AS (
        SELECT 
          DATE(scan_date) as scan_day,
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
      ),
      daily_broken_links AS (
        SELECT 
          DATE(bl.scan_date) as scan_day,
          COUNT(DISTINCT CONCAT(bl.site, '|', bl.source_url, '|', bl.target_url)) as total_broken_links
        FROM \`${projectId}.${dataset}.broken_links\` bl
        WHERE bl.scan_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
        GROUP BY DATE(bl.scan_date)
      )
      SELECT 
        ds.date,
        ds.nb_scans,
        ds.avg_pages_checked,
        ds.avg_errors_404,
        ds.max_errors_404,
        ds.min_errors_404,
        COALESCE(CAST(dbl.total_broken_links AS INT64), 0) as avg_broken_links,
        ds.avg_duration_seconds
      FROM daily_scans ds
      LEFT JOIN daily_broken_links dbl ON ds.scan_day = dbl.scan_day
      ORDER BY ds.date DESC
    `
    
    console.log(`[BigQuery getError404Evolution] Executing query on ${projectId}.${dataset}`)
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
      avg_broken_links: Number(row.avg_broken_links || 0),
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
  if (!hasBigQueryCredentials()) {
    console.warn('[BigQuery getLastError404Scan] No credentials in dev → returning null')
    return null
  }
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
  
  // Utiliser table.insert() pour éviter problèmes avec null dans query params
  const table = bigquery.dataset(dataset).table('errors_404_urls')
  
  const rows = scan.entries.map(entry => ({
    scan_id: scan.scan_id,
    scan_date: scan.scan_date,
    site: entry.site,
    path: entry.path,
    status: entry.status,
    commit_sha: scan.commit_sha || null,
    branch: scan.branch || null,
    actor: scan.actor || null,
    repo: scan.repo || null,
  }))
  
  await table.insert(rows)
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
  
  // Utiliser table.insert() pour éviter problèmes avec null dans query params
  const table = bigquery.dataset(dataset).table('broken_links')
  
  const rows = scan.links.map(link => ({
    scan_id: scan.scan_id,
    scan_date: scan.scan_date,
    site: link.site,
    source_url: link.source,
    target_url: link.target,
    commit_sha: scan.commit_sha || null,
    branch: scan.branch || null,
    actor: scan.actor || null,
    repo: scan.repo || null,
  }))
  
  await table.insert(rows)
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
  // 1) Essayer de prendre les 2 derniers scan_id présents dans errors_404_urls
  const urlsScanQuery = `
    SELECT DISTINCT scan_id, MAX(scan_date) AS scan_date
    FROM \`${projectId}.${dataset}.errors_404_urls\`
    GROUP BY scan_id
    ORDER BY scan_date DESC
    LIMIT 2
  `
  const [urlsScans] = await bigquery.query({ query: urlsScanQuery })

  // 2) Fallback: prendre depuis l'historique si la table détaillée a < 2 scans
  let toScanId: string
  let fromScanId: string
  if ((urlsScans?.length || 0) >= 2) {
    toScanId = params.to || urlsScans[0].scan_id
    fromScanId = params.from || urlsScans[1].scan_id
  } else {
    const historyScanQuery = `
      SELECT id, scan_date
      FROM \`${projectId}.${dataset}.errors_404_history\`
      ORDER BY scan_date DESC
      LIMIT 2
    `
    const [historyScans] = await bigquery.query({ query: historyScanQuery })
    if ((historyScans?.length || 0) < 2) return null
    toScanId = params.to || historyScans[0].id
    fromScanId = params.from || historyScans[1].id
  }

  // Calculer gained, lost, persisting (robuste aux jeux vides)
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
        all_data.site as site,
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
      GROUP BY all_data.site
    )
    SELECT 
      @from_scan_id as from_scan_id,
      @to_scan_id as to_scan_id,
      COALESCE((SELECT ARRAY_AGG(STRUCT(g.site, g.path) ORDER BY g.site, g.path) FROM gained g), []) as gained,
      COALESCE((SELECT ARRAY_AGG(STRUCT(l.site, l.path) ORDER BY l.site, l.path) FROM lost l), []) as lost,
      COALESCE((SELECT count FROM persisting), 0) as persisting,
      COALESCE((SELECT ARRAY_AGG(STRUCT(bs.site, bs.gained, bs.lost, bs.persisting) ORDER BY bs.site) FROM by_site bs), []) as by_site
    FROM (SELECT 1)
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
  // 1) Essayer de prendre les 2 derniers scan_id présents dans broken_links
  const blScanQuery = `
    SELECT DISTINCT scan_id, MAX(scan_date) AS scan_date
    FROM \`${projectId}.${dataset}.broken_links\`
    GROUP BY scan_id
    ORDER BY scan_date DESC
    LIMIT 2
  `
  const [blScans] = await bigquery.query({ query: blScanQuery })

  // 2) Fallback: prendre depuis l'historique si la table détaillée a < 2 scans
  let toScanId: string
  let fromScanId: string
  if ((blScans?.length || 0) >= 2) {
    toScanId = params.to || blScans[0].scan_id
    fromScanId = params.from || blScans[1].scan_id
  } else {
    const historyScanQuery = `
      SELECT id, scan_date
      FROM \`${projectId}.${dataset}.errors_404_history\`
      ORDER BY scan_date DESC
      LIMIT 2
    `
    const [historyScans] = await bigquery.query({ query: historyScanQuery })
    if ((historyScans?.length || 0) < 2) return null
    toScanId = params.to || historyScans[0].id
    fromScanId = params.from || historyScans[1].id
  }

  const deltaQuery = `
    WITH from_data AS (
      SELECT site, source_url, target_url
      FROM \`${projectId}.${dataset}.broken_links\`
      WHERE scan_id = @from_scan_id
    ),
    to_data AS (
      SELECT site, source_url, target_url
      FROM \`${projectId}.${dataset}.broken_links\`
      WHERE scan_id = @to_scan_id
    ),
    gained AS (
      SELECT t.site, NET.REG_DOMAIN(t.target_url) as domain, REGEXP_EXTRACT(t.target_url, r'[^?]*') as path
      FROM to_data t
      LEFT JOIN from_data f 
        ON t.site = f.site AND t.source_url = f.source_url AND t.target_url = f.target_url
      WHERE f.site IS NULL
    ),
    lost AS (
      SELECT f.site, NET.REG_DOMAIN(f.target_url) as domain, REGEXP_EXTRACT(f.target_url, r'[^?]*') as path
      FROM from_data f
      LEFT JOIN to_data t 
        ON f.site = t.site AND f.source_url = t.source_url AND f.target_url = t.target_url
      WHERE t.site IS NULL
    ),
    persisting AS (
      SELECT COUNT(*) as count
      FROM to_data t
      JOIN from_data f 
        ON t.site = f.site AND t.source_url = f.source_url AND t.target_url = f.target_url
    ),
    by_site AS (
      SELECT 
        all_data.site as site,
        COUNT(DISTINCT CASE WHEN t.site IS NOT NULL AND f.site IS NULL THEN CONCAT(t.site, '|', t.source_url, '|', t.target_url) END) as gained,
        COUNT(DISTINCT CASE WHEN f.site IS NOT NULL AND t.site IS NULL THEN CONCAT(f.site, '|', f.source_url, '|', f.target_url) END) as lost,
        COUNT(DISTINCT CASE WHEN t.site IS NOT NULL AND f.site IS NOT NULL THEN CONCAT(t.site, '|', t.source_url, '|', t.target_url) END) as persisting
      FROM (
        SELECT site, source_url, target_url FROM from_data
        UNION DISTINCT
        SELECT site, source_url, target_url FROM to_data
      ) all_data
      LEFT JOIN from_data f ON all_data.site = f.site AND all_data.source_url = f.source_url AND all_data.target_url = f.target_url
      LEFT JOIN to_data t ON all_data.site = t.site AND all_data.source_url = t.source_url AND all_data.target_url = t.target_url
      GROUP BY all_data.site
    )
    SELECT 
      @from_scan_id as from_scan_id,
      @to_scan_id as to_scan_id,
      COALESCE((SELECT ARRAY_AGG(STRUCT(g.site, REGEXP_EXTRACT(g.path, r'/(.*)') as path) ORDER BY g.site, g.path LIMIT 1000) FROM gained g), []) as gained,
      COALESCE((SELECT ARRAY_AGG(STRUCT(l.site, REGEXP_EXTRACT(l.path, r'/(.*)') as path) ORDER BY l.site, l.path LIMIT 1000) FROM lost l), []) as lost,
      COALESCE((SELECT count FROM persisting), 0) as persisting,
      COALESCE((SELECT ARRAY_AGG(STRUCT(bs.site, bs.gained, bs.lost, bs.persisting) ORDER BY bs.site) FROM by_site bs), []) as by_site
    FROM (SELECT 1)
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
  
  // Parser sites_results (peut être JSON ou string selon driver)
  let sitesResults: any[] = []
  try {
    sitesResults = Array.isArray((lastScan as any).sites_results)
      ? ((lastScan as any).sites_results as any[])
      : JSON.parse(String((lastScan as any).sites_results || '[]'))
  } catch {
    sitesResults = []
  }

  // Reconstruire les résultats par site
  const results: ReconstructedSiteScan[] = sitesResults.map(siteResult => ({
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
  if (!hasBigQueryCredentials()) {
    console.warn('[BigQuery getLastScansAsEvolution] No credentials in dev → returning empty list')
    return []
  }
  try {
    console.log(`[BigQuery getLastScansAsEvolution] Querying with limit=${limit}`)
    
    // Compter 404 via la table détaillée errors_404_urls (plus robuste)
    // et joindre avec broken_links pour les liens cassés visibles par scan
    const query = `
      WITH scan_history AS (
        SELECT 
          id,
          FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S', scan_date) as date,
          total_pages_checked,
          crawl_duration_seconds
        FROM \`${projectId}.${dataset}.errors_404_history\`
        ORDER BY scan_date DESC
        LIMIT @limit
      ),
      urls_404_counts AS (
        SELECT 
          scan_id,
          COUNT(DISTINCT CONCAT(site, '|', path)) as total_404_urls
        FROM \`${projectId}.${dataset}.errors_404_urls\`
        WHERE scan_id IN (SELECT id FROM scan_history)
        GROUP BY scan_id
      ),
      broken_links_counts AS (
        SELECT 
          scan_id,
          COUNT(DISTINCT CONCAT(site, '|', source_url, '|', target_url)) as total_broken_links
        FROM \`${projectId}.${dataset}.broken_links\`
        WHERE scan_id IN (SELECT id FROM scan_history)
        GROUP BY scan_id
      )
      SELECT 
        sh.date,
        1 as nb_scans,
        CAST(sh.total_pages_checked AS INT64) as avg_pages_checked,
        COALESCE(CAST(u4.total_404_urls AS INT64), 0) as avg_errors_404,
        COALESCE(CAST(u4.total_404_urls AS INT64), 0) as max_errors_404,
        COALESCE(CAST(u4.total_404_urls AS INT64), 0) as min_errors_404,
        COALESCE(CAST(blc.total_broken_links AS INT64), 0) as avg_broken_links,
        CAST(sh.crawl_duration_seconds AS INT64) as avg_duration_seconds
      FROM scan_history sh
      LEFT JOIN urls_404_counts u4 ON sh.id = u4.scan_id
      LEFT JOIN broken_links_counts blc ON sh.id = blc.scan_id
      ORDER BY sh.date DESC
    `
    
    console.log(`[BigQuery getLastScansAsEvolution] Executing query on ${projectId}.${dataset}`)
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
      avg_broken_links: Number(row.avg_broken_links || 0),
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

// ========================================
// Clone helpers for partial scans → full snapshot
// ========================================

export async function cloneError404UrlsFromPreviousScan(params: {
  prev_scan_id: string
  new_scan_id: string
  new_scan_date: string
  sites: string[]
  commit_sha?: string
  branch?: string
  actor?: string
  repo?: string
}): Promise<void> {
  if (!params.sites || params.sites.length === 0) return
  const query = `
    INSERT INTO \`${projectId}.${dataset}.errors_404_urls\`
    (scan_id, scan_date, site, path, status, commit_sha, branch, actor, repo)
    SELECT 
      @new_scan_id,
      @new_scan_date,
      site,
      path,
      status,
      @commit_sha,
      @branch,
      @actor,
      @repo
    FROM \`${projectId}.${dataset}.errors_404_urls\`
    WHERE scan_id = @prev_scan_id AND site IN UNNEST(@sites)
  `
  await bigquery.query({
    query,
    params: {
      prev_scan_id: params.prev_scan_id,
      new_scan_id: params.new_scan_id,
      new_scan_date: params.new_scan_date,
      sites: params.sites,
      commit_sha: params.commit_sha || null,
      branch: params.branch || null,
      actor: params.actor || null,
      repo: params.repo || null,
    },
  })
}

export async function cloneBrokenLinksFromPreviousScan(params: {
  prev_scan_id: string
  new_scan_id: string
  new_scan_date: string
  sites: string[]
  commit_sha?: string
  branch?: string
  actor?: string
  repo?: string
}): Promise<void> {
  if (!params.sites || params.sites.length === 0) return
  const query = `
    INSERT INTO \`${projectId}.${dataset}.broken_links\`
    (scan_id, scan_date, site, source_url, target_url, commit_sha, branch, actor, repo)
    SELECT 
      @new_scan_id,
      @new_scan_date,
      site,
      source_url,
      target_url,
      @commit_sha,
      @branch,
      @actor,
      @repo
    FROM \`${projectId}.${dataset}.broken_links\`
    WHERE scan_id = @prev_scan_id AND site IN UNNEST(@sites)
  `
  await bigquery.query({
    query,
    params: {
      prev_scan_id: params.prev_scan_id,
      new_scan_id: params.new_scan_id,
      new_scan_date: params.new_scan_date,
      sites: params.sites,
      commit_sha: params.commit_sha || null,
      branch: params.branch || null,
      actor: params.actor || null,
      repo: params.repo || null,
    },
  })
}

