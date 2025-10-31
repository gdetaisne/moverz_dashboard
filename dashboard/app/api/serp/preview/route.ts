import { NextRequest, NextResponse } from 'next/server'
import { getTopPages, getTotalImpressionsLast30Days } from '@/lib/bigquery'
import { BigQuery } from '@google-cloud/bigquery'

export const dynamic = 'force-dynamic'

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID || 'moverz-dashboard',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
})
const BQ_DATASET = process.env.BQ_DATASET || 'analytics_core'
const BQ_LOCATION = process.env.BQ_LOCATION || 'europe-west1'

type SerpPreview = {
  url: string
  title: string | null
  description: string | null
  favicon: string | null
  hasFAQ: boolean
  hasAggregateRating: boolean
  hasBreadcrumb: boolean
  hasHowTo: boolean
  hasArticle: boolean
  hasVideo: boolean
  hasLocalBusiness: boolean
  impressions: number
  sharePct: number
  intent: string | null // Intent déclaré (meta ou JSON-LD)
  intentDeclared: string | null // Intent déclaré (explicite)
  intentInferred: string | null // Intent déduit du contenu
  intentMatchScore: number // 0-100
  intentSource: 'meta' | 'jsonld' | 'inferred' | null // Source de l'intent affiché
  scoreLength: number // 0-100 (binaire)
  scoreRichResults: number // 0-100
  ctr: number | null
  position: number | null
  // Métadonnées de fiabilité
  fetchSuccess: boolean
  fetchStatusCode: number | null
  fetchRedirected: boolean
  lastFetched: number | null
}

function extractBetween(content: string, start: string, end: string): string | null {
  const s = content.toLowerCase().indexOf(start.toLowerCase())
  if (s === -1) return null
  const e = content.indexOf(end, s + start.length)
  if (e === -1) return null
  return content.slice(s + start.length, e)
}

export function inferIntentFromContent(
  pageUrl: string,
  title: string | null,
  description: string | null
): string | null {
  // Ordre : URL > Titre > Description
  const urlLower = pageUrl.toLowerCase()
  const titleLower = (title || '').toLowerCase()
  const descLower = (description || '').toLowerCase()
  const allText = `${urlLower} ${titleLower} ${descLower}`
  
  // Transactional (prioritaire)
  if (/devis|prix|tarif|tarifs|acheter|commander|reserver|estimation|demander|formulaire|contact/.test(allText)) {
    return 'transactional'
  }
  
  // Commercial
  if (/comparer|meilleur|meilleurs|avis|test|top|choisir/.test(allText)) {
    return 'commercial'
  }
  
  // Informational
  if (/guide|comment|qu'est-ce|pourquoi|tutoriel|article|blog|conseil|astuce/.test(allText)) {
    return 'informational'
  }
  
  // Navigational (détection fine)
  if (/contact|accueil|home|index|a-propos|about/.test(urlLower) && urlLower.split('/').filter(Boolean).length <= 2) {
    return 'navigational'
  }
  
  return null // Incertain
}

export function calculateIntentMatchScore(declared: string | null, inferred: string | null): number {
  if (!declared && !inferred) return 50 // Incertain (pas assez de données)
  if (!declared) return 50 // Intent non déclaré = incertain
  if (!inferred) return 50 // Impossible à déduire = incertain
  
  return declared.toLowerCase() === inferred.toLowerCase() ? 100 : 0
}

export function calculateLengthScore(title: string | null, description: string | null): number {
  // Seuils conservateurs (éviter troncature)
  const TITLE_MAX = 55 // Google tronque souvent avant 60
  const DESC_MAX = 150 // Idem pour 155
  
  let titleOK = false
  let descOK = false
  
  if (title) {
    titleOK = title.length <= TITLE_MAX
  }
  
  if (description) {
    descOK = description.length <= DESC_MAX
  }
  
  // Binaire : 100% si les 2 OK, 0% si aucun, 50% si un seul ou incertain
  if (!title && !description) return 50 // Incertain
  if (titleOK && descOK) return 100
  if (!titleOK && !descOK) return 0
  return 50 // Un seul OK ou incertain
}

function parseHtmlForSerp(
  html: string, 
  pageUrl: string, 
  impressions: number, 
  sharePct: number,
  gscMetrics: { ctr: number; position: number },
  metadata: { fetchSuccess: boolean; fetchStatusCode: number | null; fetchRedirected: boolean; lastFetched: number }
): SerpPreview {
  const lower = html.toLowerCase()
  // title
  const title = (() => {
    const t = extractBetween(html, '<title>', '</title>')
    if (!t) return null
    return t.replace(/\s+/g, ' ').trim()
  })()

  // meta description
  const description = (() => {
    const metaRegex = /<meta[^>]+name=["']description["'][^>]*>/i
    const m = html.match(metaRegex)
    if (!m) return null
    const contentMatch = m[0].match(/content=["']([^"']+)["']/i)
    return contentMatch ? contentMatch[1].replace(/\s+/g, ' ').trim() : null
  })()

  // favicon
  const favicon = (() => {
    const linkIcon = html.match(/<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]*>/i)
    const href = linkIcon?.[0].match(/href=["']([^"']+)["']/i)?.[1] || null
    if (!href) return null
    try {
      const u = new URL(href, pageUrl)
      return u.toString()
    } catch {
      return null
    }
  })()

  // Intent detection (meta tag)
  const intentFromMeta = (() => {
    const intentMetaRegex = /<meta[^>]+name=["'](?:intent|search-intent)["'][^>]*>/i
    const intentMatch = html.match(intentMetaRegex)
    if (intentMatch) {
      const contentMatch = intentMatch[0].match(/content=["']([^"']+)["']/i)
      if (contentMatch) {
        return contentMatch[1].trim()
      }
    }
    return null
  })()

  // JSON-LD detection + Rich Results supplémentaires
  let hasFAQ = false
  let hasAggregateRating = false
  let hasBreadcrumb = false
  let hasHowTo = false
  let hasArticle = false
  let hasVideo = false
  let hasLocalBusiness = false
  let intentFromJsonLd: string | null = null
  
  try {
    const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    for (const match of jsonLdBlocks) {
      const raw = match[1]
      try {
        const data = JSON.parse(raw)
        const items = Array.isArray(data) ? data : [data]
        for (const it of items) {
          const type = (it['@type'] || it.type || '').toString().toLowerCase()
          if (type.includes('faqpage')) hasFAQ = true
          if (type.includes('breadcrumblist')) hasBreadcrumb = true
          if (it.aggregateRating || type.includes('aggregateRating'.toLowerCase())) hasAggregateRating = true
          if (type.includes('howto')) hasHowTo = true
          if (type.includes('article') || type.includes('blogposting')) hasArticle = true
          if (type.includes('videoobject')) hasVideo = true
          if (type.includes('localbusiness')) hasLocalBusiness = true
          
          // Intent dans JSON-LD
          if (it.intent || it.searchIntent) {
            intentFromJsonLd = (it.intent || it.searchIntent)?.toString().trim() || null
          }
        }
      } catch {}
    }
  } catch {}

  // Intent déclaré (priorité: meta > JSON-LD)
  const intentDeclared = intentFromMeta || intentFromJsonLd || null
  const declaredSource = intentFromMeta ? 'meta' : (intentFromJsonLd ? 'jsonld' : null)
  
  // Intent déduit du contenu
  const intentInferred = inferIntentFromContent(pageUrl, title, description)
  
  // Intent final à afficher (déclaré si disponible, sinon déduit)
  const intent = intentDeclared || intentInferred || null
  // Source : si intent déclaré existe, utiliser sa source, sinon si déduit existe utiliser 'inferred'
  const finalIntentSource = intentDeclared ? declaredSource : (intentInferred ? 'inferred' : null)
  
  // Scores
  const intentMatchScore = calculateIntentMatchScore(intentDeclared, intentInferred)
  const scoreLength = calculateLengthScore(title, description)
  
  // Score Rich Results (0-100)
  const richResultsCount = [
    hasFAQ, hasAggregateRating, hasBreadcrumb,
    hasHowTo, hasArticle, hasVideo, hasLocalBusiness
  ].filter(Boolean).length
  const scoreRichResults = (richResultsCount / 7) * 100

  return { 
    url: pageUrl, 
    title, 
    description, 
    favicon, 
    hasFAQ, 
    hasAggregateRating, 
    hasBreadcrumb,
    hasHowTo,
    hasArticle,
    hasVideo,
    hasLocalBusiness,
    impressions, 
    sharePct,
    intent,
    intentDeclared,
    intentInferred,
    intentMatchScore,
    intentSource: finalIntentSource,
    scoreLength,
    scoreRichResults,
    ctr: gscMetrics.ctr,
    position: gscMetrics.position,
    ...metadata
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const site = searchParams.get('site') || undefined
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const pages = await getTopPages(site, limit)
    const totalImpr = await getTotalImpressionsLast30Days()

    // Fetch and parse in parallel (cap concurrency ~5)
    const concurrency = 5
    const results: SerpPreview[] = []
    for (let i = 0; i < pages.length; i += concurrency) {
      const chunk = pages.slice(i, i + concurrency)
      const previews = await Promise.all(
        chunk.map(async (p: any) => {
          const pageUrl: string = p.page || p.url
          const impressions = Number(p.impressions || 0)
          const sharePct = totalImpr > 0 ? (impressions / totalImpr) * 100 : 0
          const now = Date.now()
          
          try {
            console.log(`🔍 Fetching SERP for: ${pageUrl}`)
            
            // Timeout explicite 5s
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000)
            
            const res = await fetch(pageUrl, { 
              headers: { 'user-agent': 'Mozilla/5.0 (SERP-Preview Bot)' }, 
              cache: 'no-store',
              redirect: 'follow',
              signal: controller.signal
            })
            
            clearTimeout(timeoutId)
            
            // Logs debug
            console.log(`  → Status: ${res.status} ${res.redirected ? `(redirected to ${res.url})` : ''}`)
            
            // Vérifier redirection suspecte
            const expectedPath = new URL(pageUrl).pathname.split('/').filter(Boolean).pop() || ''
            const finalUrl = res.url
            const fetchRedirected = res.redirected
            
            if (fetchRedirected && expectedPath && !finalUrl.includes(expectedPath)) {
              console.warn(`  ⚠️ Redirect mismatch: ${pageUrl} → ${finalUrl}`)
            }
            
            if (!res.ok) {
              console.warn(`  ❌ Failed: HTTP ${res.status}`)
            return {
              url: pageUrl,
              title: null,
              description: null,
              favicon: null,
              hasFAQ: false,
              hasAggregateRating: false,
              hasBreadcrumb: false,
              hasHowTo: false,
              hasArticle: false,
              hasVideo: false,
              hasLocalBusiness: false,
              impressions,
              sharePct,
              intent: null,
              intentDeclared: null,
              intentInferred: null,
              intentMatchScore: 50,
              intentSource: null,
              scoreLength: 50,
              scoreRichResults: 0,
              ctr: p.ctr || null,
              position: p.position || null,
              fetchSuccess: false,
              fetchStatusCode: res.status,
              fetchRedirected,
              lastFetched: now
            }
            }
            
            const html = await res.text()
            console.log(`  ✅ HTML length: ${html.length} bytes`)
            
            return parseHtmlForSerp(
              html,
              pageUrl,
              impressions,
              sharePct,
              { ctr: p.ctr || 0, position: p.position || 0 },
              {
                fetchSuccess: true,
                fetchStatusCode: res.status,
                fetchRedirected,
                lastFetched: now
              }
            )
          } catch (e: any) {
            const isTimeout = e.name === 'AbortError'
            console.error(`  ${isTimeout ? '⏱️' : '❌'} Error for ${pageUrl}:`, e.message)
            
            return {
              url: pageUrl,
              title: null,
              description: null,
              favicon: null,
              hasFAQ: false,
              hasAggregateRating: false,
              hasBreadcrumb: false,
              hasHowTo: false,
              hasArticle: false,
              hasVideo: false,
              hasLocalBusiness: false,
              impressions,
              sharePct,
              intent: null,
              intentDeclared: null,
              intentInferred: null,
              intentMatchScore: 50,
              intentSource: null,
              scoreLength: 50,
              scoreRichResults: 0,
              ctr: p.ctr || null,
              position: p.position || null,
              fetchSuccess: false,
              fetchStatusCode: null,
              fetchRedirected: false,
              lastFetched: now
            }
          }
        })
      )
      results.push(...previews)
    }

    // Sauvegarder snapshot automatiquement (non-bloquant)
    saveSnapshot(results).catch((err) => {
      console.error('❌ Error saving SERP snapshot:', err)
      // Ne pas faire échouer la requête si snapshot échoue
    })

    return new NextResponse(
      JSON.stringify({ success: true, data: results, meta: { site: site || 'all', count: results.length, totalImpressions30d: totalImpr } }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          // soft cache at edge/proxy level
          'cache-control': 'public, max-age=0, s-maxage=21600', // 6h
        },
      }
    )
  } catch (error: any) {
    console.error('API /serp/preview error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Sauvegarde automatique des snapshots SERP
async function saveSnapshot(previews: SerpPreview[]): Promise<void> {
  if (previews.length === 0) return
  
  const snapshotDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const snapshotId = `serp_${snapshotDate}_${Date.now()}`
  
  const rows = previews.map((p) => {
    const urlObj = new URL(p.url)
    return {
      snapshot_id: snapshotId,
      snapshot_date: snapshotDate,
      domain: urlObj.hostname,
      page_url: p.url,
      impressions: p.impressions || null,
      clicks: p.ctr && p.impressions ? Math.round(p.ctr * p.impressions / 100) : null,
      ctr: p.ctr || null,
      position: p.position || null,
      share_pct: p.sharePct || null,
      intent: p.intent || null,
      intent_declared: p.intentDeclared || null,
      intent_inferred: p.intentInferred || null,
      intent_source: p.intentSource || null,
      intent_match_score: p.intentMatchScore || null,
      has_faq: p.hasFAQ,
      has_aggregate_rating: p.hasAggregateRating,
      has_breadcrumb: p.hasBreadcrumb,
      has_howto: p.hasHowTo,
      has_article: p.hasArticle,
      has_video: p.hasVideo,
      has_local_business: p.hasLocalBusiness,
      score_rich_results: p.scoreRichResults || null,
      score_length: p.scoreLength || null,
      title_length: p.title ? p.title.length : null,
      description_length: p.description ? p.description.length : null,
      fetch_success: p.fetchSuccess,
      fetch_status_code: p.fetchStatusCode || null,
      fetch_redirected: p.fetchRedirected,
    }
  })

  try {
    await bigquery
      .dataset(BQ_DATASET)
      .table('serp_snapshots')
      .insert(rows)

    console.log(`✅ Snapshot SERP sauvegardé: ${snapshotId} (${rows.length} pages)`)
  } catch (error: any) {
    // Table peut ne pas exister encore (migration pas appliquée)
    if (error.message?.includes('does not exist') || error.message?.includes('Not found')) {
      console.warn(`⚠️ Table serp_snapshots n'existe pas encore. Appliquer migration 007_serp_snapshots.sql`)
    } else {
      throw error // Re-throw autres erreurs
    }
  }
}

// Fonction pour calculer les CTR benchmarks par intent (top 10 par impressions)
export async function getCTRBenchmarksByIntent(site?: string): Promise<Record<string, number>> {
  const siteFilter = site ? `AND domain = @site` : ''
  const query = `
    WITH top_pages_by_intent AS (
      SELECT 
        domain,
        intent,
        page_url,
        impressions,
        ctr,
        ROW_NUMBER() OVER (PARTITION BY domain, intent ORDER BY impressions DESC) as rank_impressions
      FROM \`${process.env.GCP_PROJECT_ID || 'moverz-dashboard'}.${BQ_DATASET}.serp_snapshots\`
      WHERE snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND intent IS NOT NULL
        ${siteFilter}
    ),
    top_10 AS (
      SELECT 
        intent,
        AVG(ctr) as avg_ctr,
        COUNT(*) as page_count
      FROM top_pages_by_intent
      WHERE rank_impressions <= 10
        AND ctr IS NOT NULL
      GROUP BY intent
    )
    SELECT 
      intent,
      avg_ctr as benchmark_ctr,
      page_count
    FROM top_10
    ORDER BY intent
  `

  const params: Record<string, any> = {}
  if (site) params.site = site

  try {
    const [rows] = await bigquery.query({ query, location: BQ_LOCATION, params })
    const benchmarks: Record<string, number> = {}
    for (const row of rows as any[]) {
      benchmarks[row.intent] = row.benchmark_ctr || 0
    }
    return benchmarks
  } catch (error: any) {
    console.error('❌ Error fetching CTR benchmarks:', error)
    return {} // Retourner objet vide si erreur (table peut ne pas exister encore)
  }
}


