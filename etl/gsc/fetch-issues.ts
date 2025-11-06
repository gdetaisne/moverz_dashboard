/**
 * ETL GSC Issues
 * 
 * Récupère les problèmes d'indexation détectés via l'API Search Console
 * - Utilise l'API URL Inspection pour détecter les problèmes
 * - Stocke dans BigQuery table gsc_issues
 * - Vérifie les pages principales de chaque site
 */

import { google } from 'googleapis'
import { BigQuery } from '@google-cloud/bigquery'
import pino from 'pino'
import { format } from 'date-fns'

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
  sitesList: process.env.SITES_LIST || '',
  gcpSaKeyJson: process.env.GCP_SA_KEY_JSON || '',
  maxUrlsPerSite: parseInt(process.env.MAX_URLS_PER_SITE || '200', 10), // Top 200 pages par site (augmenté pour détecter plus d'erreurs)
  testMode: process.env.TEST_MODE === 'true', // Mode test : limite à 1 site et 5 pages
  includeLowTrafficPages: process.env.INCLUDE_LOW_TRAFFIC !== 'false', // Inclure pages avec peu d'impressions (peuvent avoir des problèmes)
}

if (!config.gcpSaKeyJson) {
  logger.error('GCP_SA_KEY_JSON is required')
  process.exit(1)
}

if (!config.sitesList) {
  logger.error('SITES_LIST is required')
  process.exit(1)
}

// En test mode : limite les pages mais garde tous les sites
// En production : tous les sites, toutes les pages (jusqu'à maxUrlsPerSite)
const sites = config.sitesList.split(',').map(s => s.trim()).filter(Boolean)

interface GSCIssue {
  id: string
  issueDate: string // YYYY-MM-DD
  domain: string
  issueType: 'indexing' | 'coverage' | 'mobile' | 'security' | 'rich_results'
  severity: 'error' | 'warning' | 'info'
  status: 'open' | 'resolved' | 'fixed'
  title: string
  description?: string
  affectedPagesCount: number
  affectedUrls: string[]
  detectedAt: string
  firstSeen?: string
  lastSeen: string
  resolvedAt?: string
  gscNotificationId?: string
  source: 'api' | 'url_inspection' | 'manual'
}

let authClient: any
let searchConsole: any
let bigquery: BigQuery

async function initClients() {
  try {
    const keyJson = JSON.parse(config.gcpSaKeyJson)
    const auth = new google.auth.GoogleAuth({
      credentials: keyJson,
      scopes: [
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/bigquery',
      ],
    })

    authClient = await auth.getClient()
    searchConsole = google.searchconsole({ version: 'v1', auth: authClient })
    bigquery = new BigQuery({
      projectId: config.gcpProjectId,
      credentials: keyJson,
    })

    logger.info('Clients initialized successfully')
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to initialize clients')
    throw error
  }
}

/**
 * Récupère les top pages d'un site depuis GSC (pour inspection)
 * En mode production, récupère aussi les pages avec peu d'impressions (potentiels problèmes)
 */
async function getTopPages(domain: string, limit: number = 50): Promise<string[]> {
  const siteUrl = `sc-domain:${domain}`
  const endDate = format(new Date(), 'yyyy-MM-dd')
  // Période étendue à 90 jours pour récupérer plus de pages (certaines pages peuvent avoir des données plus anciennes)
  const startDate = format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  
  logger.info({ domain, limit, startDate, endDate }, 'Fetching pages from GSC API')

  try {
    // 1. Récupérer les top pages (par impressions)
    const topPagesResponse = await searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: limit,
        orderBys: [{ dimension: 'impressions', sortOrder: 'DESCENDING' }],
      },
    })

    const topPages = (topPagesResponse.data.rows || [])
      .map((row: any) => row.keys?.[0])
      .filter(Boolean)

    logger.info({ domain, topPagesCount: topPages.length }, 'Top pages fetched')

    // 2. Si on veut aussi les pages avec peu de trafic (potentiels problèmes)
    let lowTrafficPages: string[] = []
    if (config.includeLowTrafficPages && !config.testMode && limit >= 50) {
      try {
        // Récupérer les pages avec peu d'impressions mais qui existent dans GSC
        const lowTrafficResponse = await searchConsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate,
            endDate,
            dimensions: ['page'],
            rowLimit: Math.min(100, limit), // Limiter pour éviter trop de requêtes
            orderBys: [{ dimension: 'impressions', sortOrder: 'ASCENDING' }],
          },
        })

        lowTrafficPages = (lowTrafficResponse.data.rows || [])
          .map((row: any) => row.keys?.[0])
          .filter(Boolean)
          .filter(page => !topPages.includes(page)) // Éviter les doublons
          .slice(0, 50) // Limiter à 50 pages supplémentaires

        logger.info({ domain, lowTrafficCount: lowTrafficPages.length }, 'Low traffic pages fetched')
      } catch (error: any) {
        logger.warn({ domain, error: error.message }, 'Failed to fetch low traffic pages (continuing)')
      }
    }

    // Combiner et dédupliquer
    const allPages = [...topPages, ...lowTrafficPages]
    const uniquePages = Array.from(new Set(allPages))

    logger.info({ domain, totalPages: uniquePages.length }, 'All pages fetched')
    return uniquePages
  } catch (error: any) {
    logger.error({ domain, error: error.message }, 'Failed to fetch pages')
    return []
  }
}

/**
 * Inspecte une URL via l'API URL Inspection
 * Détecte les problèmes d'indexation
 */
async function inspectUrl(domain: string, url: string): Promise<GSCIssue | null> {
  const siteUrl = `sc-domain:${domain}`
  const fullUrl = url.startsWith('http') ? url : `https://${domain}${url}`

  try {
    const response = await searchConsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: fullUrl,
        siteUrl,
      },
    })

    const inspectionResult = response.data.inspectionResult
    if (!inspectionResult) return null

    const indexStatus = inspectionResult.indexStatusResult
    if (!indexStatus || indexStatus.verdict === 'PASS') return null

    // Détection du problème
    const verdict = indexStatus.verdict || 'UNKNOWN'
    const coverageState = indexStatus.coverageState || 'UNKNOWN'
    const indexingState = indexStatus.indexingState || 'UNKNOWN'
    
    let issueType: GSCIssue['issueType'] = 'indexing'
    let severity: GSCIssue['severity'] = 'warning'
    let title = 'Problème d\'indexation détecté'
    let descriptionParts: string[] = []

    if (verdict === 'FAIL') {
      severity = 'error'
      title = `URL non indexée`
      descriptionParts.push(`❌ Verdict: ÉCHEC (non indexée)`)
      
      if (indexStatus.lastCrawlTime) {
        descriptionParts.push(`📅 Dernier crawl: ${indexStatus.lastCrawlTime}`)
      } else {
        descriptionParts.push(`⚠️ URL jamais crawlée par Google`)
      }
      
      if (indexStatus.pageFetchState) {
        descriptionParts.push(`🔍 État du fetch: ${indexStatus.pageFetchState}`)
      }
      
      if (coverageState) {
        descriptionParts.push(`📊 État de couverture: ${coverageState}`)
      }
      
      if (indexingState && indexingState !== 'UNKNOWN') {
        descriptionParts.push(`🔐 État d'indexation: ${indexingState}`)
      }
      
    } else if (coverageState === 'EXCLUDED') {
      severity = 'warning'
      title = `URL exclue de l'index`
      descriptionParts.push(`⚠️ URL exclue de l'indexation`)
      
      if (indexStatus.excludedBy) {
        descriptionParts.push(`🚫 Exclue par: ${indexStatus.excludedBy}`)
      }
      
      if (verdict && verdict !== 'UNKNOWN') {
        descriptionParts.push(`📋 Verdict: ${verdict}`)
      }
      
    } else if (verdict === 'PARTIAL') {
      severity = 'warning'
      title = `Indexation partielle`
      descriptionParts.push(`⚠️ Indexation partielle: certains éléments ne sont pas indexés`)
      
      if (indexingState) {
        descriptionParts.push(`🔐 État: ${indexingState}`)
      }
      
    } else {
      // Cas par défaut - autres problèmes
      descriptionParts.push(`⚠️ Problème détecté`)
      if (verdict && verdict !== 'UNKNOWN') {
        descriptionParts.push(`📋 Verdict: ${verdict}`)
      }
      if (coverageState && coverageState !== 'UNKNOWN') {
        descriptionParts.push(`📊 Couverture: ${coverageState}`)
      }
      if (indexingState && indexingState !== 'UNKNOWN') {
        descriptionParts.push(`🔐 Indexation: ${indexingState}`)
      }
    }
    
    // Ajouter des détails supplémentaires disponibles
    if (indexStatus.robotsTxtState) {
      descriptionParts.push(`🤖 Robots.txt: ${indexStatus.robotsTxtState}`)
    }
    
    if (indexStatus.crawledAs) {
      descriptionParts.push(`🕷️ Crawlé comme: ${indexStatus.crawledAs}`)
    }
    
    if (indexStatus.userCanonical) {
      descriptionParts.push(`🔗 Canonical: ${indexStatus.userCanonical}`)
    }
    
    const description = descriptionParts.join('\n')

    const issue: GSCIssue = {
      id: `${domain}-${url.replace(/[^a-zA-Z0-9]/g, '-')}-${format(new Date(), 'yyyyMMdd')}`,
      issueDate: format(new Date(), 'yyyy-MM-dd'),
      domain,
      issueType,
      severity,
      status: 'open',
      title,
      description,
      affectedPagesCount: 1,
      affectedUrls: [url],
      detectedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      source: 'url_inspection',
    }

    return issue
  } catch (error: any) {
    logger.warn({ domain, url, error: error.message }, 'Failed to inspect URL')
    return null
  }
}

/**
 * Récupère les issues depuis BigQuery pour détecter les duplications
 */
async function getExistingIssues(domain: string, today: string): Promise<Set<string>> {
  try {
    const query = `
      SELECT id
      FROM \`${config.gcpProjectId}.${config.bqDataset}.gsc_issues\`
      WHERE domain = @domain
        AND issue_date = @date
        AND status = 'open'
    `

    const [rows] = await bigquery.query({
      query,
      params: {
        domain,
        date: today,
      },
    })

    return new Set(rows.map((row: any) => row.id))
  } catch (error: any) {
    logger.warn({ domain, error: error.message }, 'Failed to fetch existing issues')
    return new Set()
  }
}

/**
 * Insère les issues dans BigQuery
 */
async function insertIssues(issues: GSCIssue[]) {
  if (issues.length === 0) return

  const table = bigquery.dataset(config.bqDataset).table('gsc_issues')

  const rows = issues.map(issue => ({
    id: issue.id,
    issue_date: issue.issueDate,
    domain: issue.domain,
    issue_type: issue.issueType,
    severity: issue.severity,
    status: issue.status,
    title: issue.title,
    description: issue.description || null,
    affected_pages_count: issue.affectedPagesCount,
    affected_urls: JSON.stringify(issue.affectedUrls),
    detected_at: issue.detectedAt,
    first_seen: issue.firstSeen || issue.detectedAt,
    last_seen: issue.lastSeen,
    resolved_at: issue.resolvedAt || null,
    gsc_notification_id: issue.gscNotificationId || null,
    source: issue.source,
    created_at: new Date().toISOString(),
  }))

  try {
    await table.insert(rows)
    logger.info({ count: issues.length }, 'Issues inserted into BigQuery')
  } catch (error: any) {
    logger.error({ error: error.message, count: issues.length }, 'Failed to insert issues')
    throw error
  }
}

/**
 * Traite un domaine: récupère les pages et inspecte les URLs
 */
async function processDomain(domain: string): Promise<GSCIssue[]> {
  logger.info({ domain }, 'Processing domain')

  const today = format(new Date(), 'yyyy-MM-dd')
  const existingIssues = await getExistingIssues(domain, today)

  // Récupérer les top pages (limité en mode test à 5 pages, sinon maxUrlsPerSite)
  const pageLimit = config.testMode ? 5 : config.maxUrlsPerSite
  logger.info({ domain, pageLimit, maxUrlsPerSite: config.maxUrlsPerSite, testMode: config.testMode }, 'Fetching pages with limit')
  const topPages = await getTopPages(domain, pageLimit)
  if (topPages.length === 0) {
    logger.warn({ domain }, 'No pages found')
    return []
  }

  // Inspecter chaque page (avec limite de rate limiting)
  const issues: GSCIssue[] = []
  const batchSize = 5 // Traiter par batch pour éviter rate limiting

  for (let i = 0; i < topPages.length; i += batchSize) {
    const batch = topPages.slice(i, i + batchSize)
    
    const batchPromises = batch.map(url => inspectUrl(domain, url))
    const batchResults = await Promise.all(batchPromises)
    
    const batchIssues = batchResults.filter(Boolean) as GSCIssue[]
    issues.push(...batchIssues)

    // Pause entre les batches
    if (i + batchSize < topPages.length) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2s pause
    }
  }

  // Filtrer les issues déjà existantes
  const newIssues = issues.filter(issue => !existingIssues.has(issue.id))

  logger.info({ 
    domain, 
    totalPages: topPages.length, 
    issuesFound: issues.length,
    newIssues: newIssues.length 
  }, 'Domain processed')

  return newIssues
}

/**
 * Vérifie si une URL a encore un problème dans GSC
 * Retourne true si le problème existe encore, false s'il est résolu
 */
async function checkIfIssueStillExists(domain: string, url: string): Promise<boolean> {
  const siteUrl = `sc-domain:${domain}`
  const fullUrl = url.startsWith('http') ? url : `https://${domain}${url}`

  try {
    const response = await searchConsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: fullUrl,
        siteUrl,
      },
    })

    const inspectionResult = response.data.inspectionResult
    if (!inspectionResult) return false

    const indexStatus = inspectionResult.indexStatusResult
    if (!indexStatus) return false

    // Si le verdict est PASS, le problème est résolu
    if (indexStatus.verdict === 'PASS') {
      return false
    }

    // Sinon, le problème existe encore
    return true
  } catch (error: any) {
    // En cas d'erreur, on considère que le problème existe encore (pour ne pas marquer comme résolu par erreur)
    logger.warn({ domain, url, error: error.message }, 'Failed to check issue status, keeping as open')
    return true
  }
}

/**
 * Vérifie les alertes "open" existantes et les marque comme "resolved" si elles n'existent plus dans GSC
 */
async function verifyExistingIssues(): Promise<number> {
  try {
    // Récupérer toutes les alertes "open" des 90 derniers jours
    const query = `
      SELECT 
        id,
        domain,
        affected_urls,
        detected_at
      FROM \`${config.gcpProjectId}.${config.bqDataset}.gsc_issues\`
      WHERE status = 'open'
        AND issue_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
      ORDER BY detected_at DESC
      LIMIT 500
    `

    const [rows] = await bigquery.query({ query })
    
    if (rows.length === 0) {
      logger.info('No open issues to verify')
      return 0
    }

    logger.info({ count: rows.length }, 'Verifying existing open issues')

    const resolvedIssues: string[] = []
    const batchSize = 5 // Traiter par batch pour éviter rate limiting
    let checked = 0

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (row: any) => {
        const urls = row.affected_urls ? JSON.parse(row.affected_urls) : []
        if (urls.length === 0) return null

        // Vérifier seulement la première URL (les autres sont généralement similaires)
        const url = urls[0]
        const stillExists = await checkIfIssueStillExists(row.domain, url)
        
        checked++
        if (!stillExists) {
          logger.info({ id: row.id, domain: row.domain, url }, 'Issue resolved in GSC')
          return row.id
        }
        
        return null
      })

      const batchResults = await Promise.all(batchPromises)
      const batchResolved = batchResults.filter(Boolean) as string[]
      resolvedIssues.push(...batchResolved)

      // Pause entre les batches pour éviter rate limiting
      if (i + batchSize < rows.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)) // 2s pause
      }

      logger.info({ checked, resolved: resolvedIssues.length, total: rows.length }, 'Progress verification')
    }

    // Marquer comme résolues dans BigQuery
    if (resolvedIssues.length > 0) {
      const resolvedAt = new Date().toISOString()
      
      // Utiliser MERGE pour mettre à jour le statut (plus sûr pour tables partitionnées)
      // Traiter par batch de 50 pour éviter les limites de requête
      const batchSize = 50
      
      for (let i = 0; i < resolvedIssues.length; i += batchSize) {
        const batch = resolvedIssues.slice(i, i + batchSize)
        
        try {
          // Construire la liste d'IDs pour le MERGE avec échappement SQL
          const idsEscaped = batch.map(id => id.replace(/'/g, "''").replace(/\\/g, '\\\\'))
          
          const mergeQuery = `
            MERGE \`${config.gcpProjectId}.${config.bqDataset}.gsc_issues\` AS target
            USING (
              SELECT id FROM UNNEST([${idsEscaped.map(id => `'${id}'`).join(',')}]) AS id
            ) AS source
            ON target.id = source.id
              AND target.status = 'open'
            WHEN MATCHED THEN
              UPDATE SET
                status = 'resolved',
                resolved_at = TIMESTAMP(@resolvedAt)
          `

          await bigquery.query({
            query: mergeQuery,
            params: {
              resolvedAt,
            },
          })
          
          logger.info({ batchSize: batch.length, totalResolved: i + batch.length }, 'Batch of issues marked as resolved')
        } catch (error: any) {
          logger.error({ batchSize: batch.length, error: error.message }, 'Failed to mark batch as resolved')
          
          // Fallback: essayer une par une si le batch échoue
          logger.info('Falling back to individual updates')
          for (const issueId of batch) {
            try {
              const updateQuery = `
                UPDATE \`${config.gcpProjectId}.${config.bqDataset}.gsc_issues\`
                SET 
                  status = 'resolved',
                  resolved_at = TIMESTAMP(@resolvedAt)
                WHERE id = @issueId
                  AND status = 'open'
              `

              await bigquery.query({
                query: updateQuery,
                params: {
                  issueId,
                  resolvedAt,
                },
              })
            } catch (err: any) {
              logger.error({ issueId, error: err.message }, 'Failed to mark issue as resolved individually')
            }
          }
        }
      }

      logger.info({ count: resolvedIssues.length }, 'All issues marked as resolved')
    }

    return resolvedIssues.length
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to verify existing issues')
    return 0
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await initClients()

    logger.info({ sitesCount: sites.length }, 'Starting GSC issues fetch')

    // 1. Vérifier les alertes existantes et marquer comme résolues si nécessaire
    const resolvedCount = await verifyExistingIssues()
    logger.info({ resolvedCount }, 'Existing issues verification completed')

    // 2. Récupérer les nouvelles alertes
    const allIssues: GSCIssue[] = []

    for (const domain of sites) {
      try {
        const issues = await processDomain(domain)
        allIssues.push(...issues)
      } catch (error: any) {
        logger.error({ domain, error: error.message }, 'Failed to process domain')
      }
    }

    if (allIssues.length > 0) {
      await insertIssues(allIssues)
    }

    logger.info({ 
      totalIssues: allIssues.length,
      resolvedIssues: resolvedCount,
      sitesProcessed: sites.length 
    }, 'ETL completed successfully')

    process.exit(0)
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'ETL failed')
    process.exit(1)
  }
}

// Exporter la fonction pour être utilisable comme module
export { main as fetchGSCIssues }

// Exécuter si lancé directement
main().catch((error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Unhandled error')
  process.exit(1)
})

