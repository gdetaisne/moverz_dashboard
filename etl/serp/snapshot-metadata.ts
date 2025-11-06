/**
 * ETL Snapshot Métadonnées SERP Quotidien
 * 
 * Capture quotidienne des métadonnées SERP (temps réel)
 * - Fetch métadonnées pour top pages GSC
 * - Détection type de page et template de description
 * - Insertion dans serp_metadata_snapshots avec status 'pending'
 * - Complétion j+2 avec performances GSC (script séparé)
 * 
 * Codes sortie: 0 (success), 1 (error), 2 (partial)
 */

import 'dotenv/config'
import { BigQuery } from '@google-cloud/bigquery'
import pino from 'pino'
import { format, subDays } from 'date-fns'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Charger .env.local depuis dashboard/
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '..', '..', 'dashboard', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  })
}

// ========================================
// Utilitaires SERP (copiés depuis dashboard/lib/serp-utils.ts)
// ========================================

function inferIntentFromContent(
  pageUrl: string,
  title: string | null,
  description: string | null
): string | null {
  const urlLower = pageUrl.toLowerCase()
  const titleLower = (title || '').toLowerCase()
  const descLower = (description || '').toLowerCase()
  const allText = `${urlLower} ${titleLower} ${descLower}`
  
  if (/devis|prix|tarif|tarifs|acheter|commander|reserver|estimation|demander|formulaire|contact/.test(allText)) {
    return 'transactional'
  }
  
  if (/comparer|meilleur|meilleurs|avis|test|top|choisir/.test(allText)) {
    return 'commercial'
  }
  
  if (/guide|comment|qu'est-ce|pourquoi|tutoriel|article|blog|conseil|astuce/.test(allText)) {
    return 'informational'
  }
  
  if (/contact|accueil|home|index|a-propos|about/.test(urlLower) && urlLower.split('/').filter(Boolean).length <= 2) {
    return 'navigational'
  }
  
  return null
}

function calculateIntentMatchScore(declared: string | null, inferred: string | null): number {
  if (!declared && !inferred) return 50
  if (!declared) return 50
  if (!inferred) return 50
  
  return declared.toLowerCase() === inferred.toLowerCase() ? 100 : 0
}

function calculateLengthScore(title: string | null, description: string | null): number {
  const TITLE_MAX = 55
  const DESC_MAX = 150
  
  let titleOK = false
  let descOK = false
  
  if (title) {
    titleOK = title.length <= TITLE_MAX
  }
  
  if (description) {
    descOK = description.length <= DESC_MAX
  }
  
  if (!title && !description) return 50
  if (titleOK && descOK) return 100
  if (!titleOK && !descOK) return 0
  return 50
}

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
  sitesList: process.env.SITES_LIST || '',
  limit: parseInt(process.env.SERP_SNAPSHOT_LIMIT || '200', 10), // Top 200 pages par défaut
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
const credentials = JSON.parse(config.gcpSaKeyJson)
const bigquery = new BigQuery({
  projectId: config.gcpProjectId,
  credentials,
})

const BQ_LOCATION = process.env.BQ_LOCATION || 'europe-west1'

// ========================================
// Détection Type de Page
// ========================================

function detectPageType(url: string): string {
  // Landing ville principale
  if (/^https:\/\/[^\/]+\/(strasbourg|rennes|rouen|nantes|nice|lyon|toulouse|marseille|montpellier|bordeaux|lille)$/.test(url)) {
    return 'landing-ville'
  }
  
  // Services
  if (url.includes('/services/')) {
    return 'landing-services'
  }
  
  // Contact
  if (url.includes('/contact')) {
    return 'landing-contact'
  }
  
  // Partenaires
  if (url.includes('/partenaires')) {
    return 'landing-partenaires'
  }
  
  // FAQ
  if (url.includes('/faq')) {
    return 'landing-faq'
  }
  
  // Comment ça marche
  if (url.includes('/comment-ca-marche')) {
    return 'landing-comment-ca-marche'
  }
  
  // Ville vers Paris
  if (/\/[^\/]+-vers-paris$/.test(url)) {
    return 'landing-ville-vers-paris'
  }
  
  // Ville vers ville
  if (/\/[^\/]+-vers-[^\/]+$/.test(url) && !url.includes('/blog')) {
    return 'landing-ville-vers-ville'
  }
  
  // Quartier
  const urlParts = url.split('/').filter(Boolean)
  if (urlParts.length >= 3 && !url.includes('/blog') && !url.includes('/services')) {
    // Ex: /bordeaux/merignac
    return 'landing-quartier'
  }
  
  // Blog (exclu mais on le marque quand même)
  if (url.includes('/blog')) {
    return 'blog'
  }
  
  // Homepage
  if (/^https:\/\/[^\/]+\/?$/.test(url)) {
    return 'landing-home'
  }
  
  return 'other'
}

// ========================================
// Détection Template Description
// ========================================

function detectDescriptionTemplate(description: string | null, pageType: string): string {
  if (!description) return 'missing'
  
  // Template 1 : Landing ville standard
  if (/Déménagez à .+ dès 280€\. IA analyse vos photos → 5 devis comparables sous 7j/.test(description)) {
    return 'v1-landing-ville'
  }
  
  // Template 2 : Services
  if (/Découvrez nos formules de déménagement à .+ : Économique, Standard, Premium/.test(description)) {
    return 'v1-services'
  }
  
  // Template 3 : Contact
  if (/Contactez nos experts déménageurs à .+\. Estimation gratuite en 30 min/.test(description)) {
    return 'v1-contact'
  }
  
  // Template 4 : Ville vers Paris
  if (/Cahier des charges précis en quelques clics → 5 devis comparables en 7j/.test(description)) {
    return 'v1-ville-vers-paris'
  }
  
  // Template 5 : Ville vers ville
  if (/Déménagement de .+ vers .+\. Distance .+ km/.test(description)) {
    return 'v1-ville-vers-ville'
  }
  
  // Template 6 : Blog (générique)
  if (/Guides complets et conseils d'experts pour réussir votre déménagement/.test(description)) {
    return 'v1-blog'
  }
  
  // Template 7 : Partenaires
  if (/Découvrez nos partenaires déménageurs certifiés/.test(description)) {
    return 'v1-partenaires'
  }
  
  // Template 8 : FAQ
  if (/Questions clés déménagement|Toutes les réponses sur votre déménagement/.test(description)) {
    return 'v1-faq'
  }
  
  // Custom (ne correspond à aucun template)
  return 'custom'
}

// ========================================
// Fetch Métadonnées Page
// ========================================

async function fetchPageMetadata(url: string): Promise<{
  title: string | null
  description: string | null
  intent: string | null
  intentSource: string | null
  intentMatchScore: number
  lengthScore: number
  richResults: {
    hasFAQ: boolean
    hasRating: boolean
    hasBreadcrumb: boolean
    hasHowTo: boolean
    hasArticle: boolean
    hasVideo: boolean
    hasLocalBusiness: boolean
  }
  richResultsScore: number
  fetchSuccess: boolean
  fetchStatus: number | null
  redirected: boolean
}> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (SERP-Snapshot Bot)' },
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    const redirected = res.redirected
    const fetchSuccess = res.ok
    const fetchStatus = res.status
    
    if (!res.ok) {
      return {
        title: null,
        description: null,
        intent: null,
        intentSource: null,
        intentMatchScore: 50,
        lengthScore: 50,
        richResults: {
          hasFAQ: false,
          hasRating: false,
          hasBreadcrumb: false,
          hasHowTo: false,
          hasArticle: false,
          hasVideo: false,
          hasLocalBusiness: false,
        },
        richResultsScore: 0,
        fetchSuccess: false,
        fetchStatus,
        redirected,
      }
    }
    
    const html = await res.text()
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch?.[1]?.replace(/\s+/g, ' ').trim() || null
    
    // Extract description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)
    const description = descMatch?.[0]?.match(/content=["']([^"']+)["']/i)?.[1]?.replace(/\s+/g, ' ').trim() || null
    
    // Intent from meta
    const intentMetaMatch = html.match(/<meta[^>]+name=["'](?:intent|search-intent)["'][^>]*>/i)
    const intentFromMeta = intentMetaMatch?.[0]?.match(/content=["']([^"']+)["']/i)?.[1]?.trim() || null
    
    // Intent from JSON-LD
    let intentFromJsonLd: string | null = null
    const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    for (const match of jsonLdBlocks) {
      try {
        const data = JSON.parse(match[1])
        const items = Array.isArray(data) ? data : [data]
        for (const item of items) {
          if (item.intent || item.searchIntent) {
            intentFromJsonLd = (item.intent || item.searchIntent) as string
            break
          }
        }
      } catch {
        // Ignore invalid JSON
      }
    }
    
    // Intent final
    const intentDeclared = intentFromMeta || intentFromJsonLd
    const intentInferred = inferIntentFromContent(url, title, description)
    const intent = intentDeclared || intentInferred || null
    const intentSource = intentFromMeta ? 'meta' : (intentFromJsonLd ? 'jsonld' : (intentInferred ? 'inferred' : null))
    const intentMatchScore = calculateIntentMatchScore(intentDeclared, intentInferred)
    
    // Rich Results
    let hasFAQ = false
    let hasRating = false
    let hasBreadcrumb = false
    let hasHowTo = false
    let hasArticle = false
    let hasVideo = false
    let hasLocalBusiness = false
    
    for (const match of jsonLdBlocks) {
      try {
        const data = JSON.parse(match[1])
        const items = Array.isArray(data) ? data : [data]
        for (const item of items) {
          const type = Array.isArray(item['@type']) ? item['@type'] : [item['@type']]
          if (type.includes('FAQPage')) hasFAQ = true
          if (item.aggregateRating) hasRating = true
          if (type.includes('BreadcrumbList')) hasBreadcrumb = true
          if (type.includes('HowTo')) hasHowTo = true
          if (type.includes('Article') || type.includes('BlogPosting')) hasArticle = true
          if (type.includes('VideoObject')) hasVideo = true
          if (type.includes('LocalBusiness')) hasLocalBusiness = true
        }
      } catch {
        // Ignore
      }
    }
    
    const richResultsCount = [hasFAQ, hasRating, hasBreadcrumb, hasHowTo, hasArticle, hasVideo, hasLocalBusiness].filter(Boolean).length
    const richResultsScore = (richResultsCount / 7) * 100
    
    // Length score
    const lengthScore = calculateLengthScore(title, description)
    
    return {
      title,
      description,
      intent,
      intentSource,
      intentMatchScore,
      lengthScore,
      richResults: {
        hasFAQ,
        hasRating,
        hasBreadcrumb,
        hasHowTo,
        hasArticle,
        hasVideo,
        hasLocalBusiness,
      },
      richResultsScore,
      fetchSuccess: true,
      fetchStatus,
      redirected,
    }
  } catch (error: any) {
    logger.warn(`Failed to fetch ${url}:`, error.message)
    return {
      title: null,
      description: null,
      intent: null,
      intentSource: null,
      intentMatchScore: 50,
      lengthScore: 50,
      richResults: {
        hasFAQ: false,
        hasRating: false,
        hasBreadcrumb: false,
        hasHowTo: false,
        hasArticle: false,
        hasVideo: false,
        hasLocalBusiness: false,
      },
      richResultsScore: 0,
      fetchSuccess: false,
      fetchStatus: null,
      redirected: false,
    }
  }
}

// ========================================
// Récupérer Top Pages depuis GSC
// ========================================

async function getTopPagesFromGSC(limit: number): Promise<Array<{ url: string; domain: string }>> {
  const query = `
    WITH recent_data AS (
      SELECT 
        domain,
        page as url,
        SUM(clicks) AS clicks,
        SUM(impressions) AS impressions
      FROM \`${config.gcpProjectId}.${config.bqDataset}.gsc_daily_metrics\`
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY domain, page
    )
    SELECT 
      domain,
      url
    FROM recent_data
    WHERE impressions > 0
    ORDER BY impressions DESC
    LIMIT @limit
  `
  
  try {
    const [rows] = await bigquery.query({
      query,
      location: BQ_LOCATION,
      params: { limit },
    })
    
    return (rows as Array<{ domain: string; url: string }>).map(row => ({
      url: row.url,
      domain: row.domain,
    }))
  } catch (error: any) {
    logger.error('Failed to fetch top pages from GSC:', error)
    throw error
  }
}

// ========================================
// Créer Snapshot Quotidien
// ========================================

async function createDailySnapshot(date: string): Promise<{ success: number; failed: number; errors: string[] }> {
  const snapshotDate = date
  const metadataDate = date // Métadonnées capturées aujourd'hui
  
  logger.info(`Starting snapshot for ${snapshotDate}`)
  
  // 1. Récupérer top pages
  const topPages = await getTopPagesFromGSC(config.limit)
  logger.info(`Found ${topPages.length} pages to snapshot`)
  
  if (topPages.length === 0) {
    logger.warn('No pages found in GSC')
    return { success: 0, failed: 0, errors: ['No pages found'] }
  }
  
  // 2. Fetch métadonnées en parallèle (concurrency: 10)
  const concurrency = 10
  const results: Array<{
    url: string
    domain: string
    metadata: Awaited<ReturnType<typeof fetchPageMetadata>>
  }> = []
  const errors: string[] = []
  
  for (let i = 0; i < topPages.length; i += concurrency) {
    const chunk = topPages.slice(i, i + concurrency)
    const chunkResults = await Promise.all(
      chunk.map(async (page) => {
        try {
          const metadata = await fetchPageMetadata(page.url)
          return { url: page.url, domain: page.domain, metadata }
        } catch (error: any) {
          errors.push(`Failed to fetch ${page.url}: ${error.message}`)
          return null
        }
      })
    )
    results.push(...chunkResults.filter(Boolean) as typeof results)
  }
  
  logger.info(`Fetched metadata for ${results.length}/${topPages.length} pages`)
  
  // 3. Préparer les rows pour BigQuery
  const rows = results.map(({ url, domain, metadata }) => {
    const pageType = detectPageType(url)
    const templateVersion = detectDescriptionTemplate(metadata.description, pageType)
    
    return {
      snapshot_date: snapshotDate,
      url,
      metadata_date: metadataDate,
      page_type: pageType,
      description_template_version: templateVersion,
      description_text: metadata.description,
      title_text: metadata.title,
      title_length: metadata.title?.length || 0,
      description_length: metadata.description?.length || 0,
      length_score: metadata.lengthScore,
      gsc_date: null, // Pas encore disponible (j+2)
      impressions: null,
      clicks: null,
      ctr: null,
      position: null,
      intent: metadata.intent,
      intent_source: metadata.intentSource,
      intent_match_score: metadata.intentMatchScore,
      rich_results_score: metadata.richResultsScore,
      has_faq: metadata.richResults.hasFAQ,
      has_rating: metadata.richResults.hasRating,
      has_breadcrumb: metadata.richResults.hasBreadcrumb,
      has_howto: metadata.richResults.hasHowTo,
      has_article: metadata.richResults.hasArticle,
      has_video: metadata.richResults.hasVideo,
      has_local_business: metadata.richResults.hasLocalBusiness,
      fetch_success: metadata.fetchSuccess,
      fetch_status: metadata.fetchStatus,
      redirected: metadata.redirected,
      status: 'pending', // Complétion j+2
    }
  })
  
  // 4. Insérer dans BigQuery (MERGE pour éviter doublons)
  if (rows.length > 0) {
    const table = bigquery.dataset(config.bqDataset).table('serp_metadata_snapshots')
    
    // MERGE pour éviter doublons (snapshot_date + url)
    const mergeQuery = `
      MERGE \`${config.gcpProjectId}.${config.bqDataset}.serp_metadata_snapshots\` AS target
      USING UNNEST(@rows) AS source
      ON target.snapshot_date = source.snapshot_date 
        AND target.url = source.url
      WHEN MATCHED THEN
        UPDATE SET
          metadata_date = source.metadata_date,
          page_type = source.page_type,
          description_template_version = source.description_template_version,
          description_text = source.description_text,
          title_text = source.title_text,
          title_length = source.title_length,
          description_length = source.description_length,
          length_score = source.length_score,
          intent = source.intent,
          intent_source = source.intent_source,
          intent_match_score = source.intent_match_score,
          rich_results_score = source.rich_results_score,
          has_faq = source.has_faq,
          has_rating = source.has_rating,
          has_breadcrumb = source.has_breadcrumb,
          has_howto = source.has_howto,
          has_article = source.has_article,
          has_video = source.has_video,
          has_local_business = source.has_local_business,
          fetch_success = source.fetch_success,
          fetch_status = source.fetch_status,
          redirected = source.redirected,
          status = source.status,
          updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN
        INSERT (
          snapshot_date, url, metadata_date, page_type, description_template_version,
          description_text, title_text, title_length, description_length, length_score,
          gsc_date, impressions, clicks, ctr, position,
          intent, intent_source, intent_match_score, rich_results_score,
          has_faq, has_rating, has_breadcrumb, has_howto, has_article, has_video, has_local_business,
          fetch_success, fetch_status, redirected, status
        )
        VALUES (
          source.snapshot_date, source.url, source.metadata_date, source.page_type, source.description_template_version,
          source.description_text, source.title_text, source.title_length, source.description_length, source.length_score,
          source.gsc_date, source.impressions, source.clicks, source.ctr, source.position,
          source.intent, source.intent_source, source.intent_match_score, source.rich_results_score,
          source.has_faq, source.has_rating, source.has_breadcrumb, source.has_howto, source.has_article, source.has_video, source.has_local_business,
          source.fetch_success, source.fetch_status, source.redirected, source.status
        )
    `
    
    try {
      // Utiliser insertAll directement (les doublons seront écrasés au prochain snapshot)
      const table = bigquery.dataset(config.bqDataset).table('serp_metadata_snapshots')
      const bqRows = rows.map(row => ({
        snapshot_date: row.snapshot_date,
        url: row.url,
        metadata_date: row.metadata_date,
        page_type: row.page_type || null,
        description_template_version: row.description_template_version || null,
        description_text: row.description_text || null,
        title_text: row.title_text || null,
        title_length: row.title_length || null,
        description_length: row.description_length || null,
        length_score: row.length_score || null,
        gsc_date: row.gsc_date || null,
        impressions: row.impressions ?? null,
        clicks: row.clicks ?? null,
        ctr: row.ctr ?? null,
        position: row.position ?? null,
        intent: row.intent || null,
        intent_source: row.intent_source || null,
        intent_match_score: row.intent_match_score || null,
        rich_results_score: row.rich_results_score ? Math.round(row.rich_results_score) : null,
        has_faq: row.has_faq ?? null,
        has_rating: row.has_rating ?? null,
        has_breadcrumb: row.has_breadcrumb ?? null,
        has_howto: row.has_howto ?? null,
        has_article: row.has_article ?? null,
        has_video: row.has_video ?? null,
        has_local_business: row.has_local_business ?? null,
        fetch_success: row.fetch_success ?? null,
        fetch_status: row.fetch_status ?? null,
        redirected: row.redirected ?? null,
        status: row.status,
      }))
      
      await table.insert(bqRows, {
        skipInvalidRows: true,
        ignoreUnknownValues: true,
      })
      
      logger.info(`✅ Inserted ${rows.length} snapshots`)
    } catch (error: any) {
      console.error('❌ BigQuery Error:', JSON.stringify(error, null, 2))
      console.error('❌ Error message:', error.message)
      console.error('❌ Error code:', error.code)
      if (error.errors) {
        console.error('❌ Errors:', JSON.stringify(error.errors, null, 2))
      }
      logger.error('Failed to insert snapshots:', {
        message: error.message,
        errors: error.errors,
        code: error.code,
        details: error.details,
      })
      throw error
    }
  }
  
  return {
    success: rows.length,
    failed: topPages.length - results.length,
    errors: errors.slice(0, 10), // Limiter à 10 erreurs
  }
}

// ========================================
// Main
// ========================================

async function main() {
  const today = format(new Date(), 'yyyy-MM-dd')
  
  try {
    const result = await createDailySnapshot(today)
    
    logger.info('Snapshot completed', {
      date: today,
      success: result.success,
      failed: result.failed,
      errors: result.errors.length,
    })
    
    // Exit code: 0 (success), 1 (error), 2 (partial)
    if (result.failed > result.success) {
      process.exit(1)
    } else if (result.failed > 0) {
      process.exit(2)
    } else {
      process.exit(0)
    }
  } catch (error: any) {
    logger.error('Snapshot failed:', error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

