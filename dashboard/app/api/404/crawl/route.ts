import { NextRequest } from 'next/server'
import * as cheerio from 'cheerio'
import { insertError404History, insertError404UrlsScan, insertBrokenLinksScan } from '@/lib/bigquery'
import { randomUUID } from 'crypto'

/**
 * POST /api/404/crawl
 * Crawler récursif avec Server-Sent Events (SSE) pour affichage progressif
 * Approche en 2 passes : découverte des URLs puis évaluation des liens
 */

const SITES = [
  'devis-demenageur-marseille.fr',
  'devis-demenageur-strasbourg.fr',
  'devis-demenageur-lille.fr',
  'devis-demenageur-rennes.fr',
  'devis-demenageur-rouen.fr',
  'devis-demenageur-nice.fr',
  'devis-demenageur-nantes.fr',
  'devis-demenageur-toulousain.fr',
  'devis-demenageur-lyon.fr',
  'www.bordeaux-demenageur.fr',
  'devis-demenageur-montpellier.fr',
]

interface CrawlResult {
  site: string
  total_checked: number
  total_pages_found: number // Nombre total de pages uniques trouvées (analysées + en file d'attente)
  pages_not_analyzed: number // Pages trouvées mais non analysées (limite atteinte)
  max_pages_per_site: number // Limite maximale de pages analysées
  errors_404: number
  broken_links: number
  errors_list: string[]
  broken_links_list: Array<{ source: string; target: string }>
  scan_date: string
  crawl_duration: number
  progress_percent: number
  status: 'in_progress' | 'completed'
  errors_detailed?: Array<{ path: string; status: '404' | '410' }>
}

type ProgressCallback = (result: Partial<CrawlResult>) => void

// Limite pour éviter les crawls trop longs
const MAX_PAGES_PER_SITE = 300
const REQUEST_TIMEOUT = 8000 // 8s timeout

/**
 * Normalise une URL :
 * - Supprime le fragment (#fragment)
 * - Supprime les paramètres UTM (?utm_source=...)
 * - Normalise le trailing slash
 */
function normalizeUrl(urlString: string, baseUrl?: string): string {
  try {
    const url = baseUrl ? new URL(urlString, baseUrl) : new URL(urlString)
    
    // Supprimer le fragment
    url.hash = ''
    
    // Supprimer les paramètres UTM
    const params = new URLSearchParams(url.search)
    for (const key of params.keys()) {
      if (key.startsWith('utm_')) {
        params.delete(key)
      }
    }
    url.search = params.toString()
    
    // Normaliser le pathname (supprimer trailing slash sauf pour racine)
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }
    
    // Retourner URL normalisée : protocol + hostname + pathname (sans search si vide)
    return `${url.protocol}//${url.hostname}${url.pathname}${url.search || ''}`
  } catch {
    return urlString
  }
}

// Type pour stocker le statut d'une URL
type UrlStatus = 200 | 301 | 302 | 404 | 410 | 500 | 'timeout' | 'error'

/**
 * Skip les fichiers non-HTML
 */
function shouldSkipUrl(url: string): boolean {
  return (
    url.endsWith('.pdf') ||
    url.endsWith('.jpg') ||
    url.endsWith('.jpeg') ||
    url.endsWith('.png') ||
    url.endsWith('.gif') ||
    url.endsWith('.zip') ||
    url.includes('/wp-admin/') ||
    url.includes('/wp-content/')
  )
}

async function crawlSite(
  domain: string, 
  onProgress?: ProgressCallback
): Promise<CrawlResult> {
  const startTime = Date.now()
  
  console.log(`🕷️ Crawling ${domain}... (2 passes: découverte puis évaluation)`)
  
  // ========================================
  // PASS 1 : DÉCOUVERTE & STATUT
  // ========================================
  
  const urlStatus = new Map<string, UrlStatus>() // url_normalisée -> statut
  const edges: Array<{ source: string; target: string }> = [] // Tous les liens (source -> target)
  const toVisit = new Set<string>()
  const visited = new Set<string>()
  const errors: string[] = []
  const errorsDetailed: Array<{ path: string; status: '404' | '410' }> = []
  const allFoundPages = new Set<string>()
  
  // Initialiser avec la page d'accueil
  const startUrl = normalizeUrl(`https://${domain}/`)
  toVisit.add(startUrl)
  allFoundPages.add(startUrl)
  
  // Pass 1 : Crawl récursif pour découvrir toutes les URLs et leurs statuts
  while (toVisit.size > 0 && visited.size < MAX_PAGES_PER_SITE) {
    const urlRaw = Array.from(toVisit)[0]
    toVisit.delete(urlRaw)
    
    // Normaliser l'URL avant traitement
    const url = normalizeUrl(urlRaw)
    
    if (visited.has(url)) continue
    visited.add(url)
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
      
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Moverz-Analytics-Bot/1.0',
        },
      })
      
      clearTimeout(timeoutId)
      
      // Stocker le statut
      let status: UrlStatus = response.status as UrlStatus
      if (status === 301 || status === 302) {
        status = 301 // Normaliser les redirections
      }
      urlStatus.set(url, status)
      
      // Enregistrer les erreurs 404/410
      if (status === 404 || status === 410) {
        const path = new URL(url).pathname
        errors.push(path)
        errorsDetailed.push({ path, status: status === 404 ? '404' : '410' })
        console.log(`  ❌ ${status}: ${path}`)
      }
      
      // Si c'est une page HTML valide, parser les liens
      const contentType = response.headers.get('content-type') || ''
      if ((status === 200 || status === 301) && contentType.includes('text/html')) {
        const html = await response.text()
        const $ = cheerio.load(html)
        
        $('a[href]').each((_, element) => {
          const href = $(element).attr('href')
          if (!href) return
          
          try {
            const absoluteUrl = new URL(href, url)
            
            // Seulement les liens internes
            if (absoluteUrl.hostname === domain) {
              const normalizedTarget = normalizeUrl(absoluteUrl.toString())
              
              // Skip les fichiers non-HTML
              if (shouldSkipUrl(normalizedTarget)) return
              
              // Ajouter l'arête (lien)
              // Normaliser aussi la source pour cohérence
              const normalizedSource = normalizeUrl(url)
              edges.push({
                source: normalizedSource,
                target: normalizedTarget,
              })
              
              // Ajouter à la liste des pages trouvées et à visiter si pas déjà visitée
              allFoundPages.add(normalizedTarget)
              
              if (!visited.has(normalizedTarget) && !toVisit.has(normalizedTarget)) {
                // Vérifier si on peut encore crawler (limite)
                if (visited.size + toVisit.size < MAX_PAGES_PER_SITE) {
                  toVisit.add(normalizedTarget)
                }
              }
            }
          } catch (e) {
            // URL invalide, skip
          }
        })
      }
      
    } catch (error: any) {
      // Timeout ou erreur réseau
      if (error.name === 'AbortError') {
        urlStatus.set(url, 'timeout')
      } else {
        urlStatus.set(url, 'error')
        console.warn(`  ⚠️ Error fetching ${url}:`, error.message)
      }
    }
    
    // Mise à jour du progrès tous les 10 pages
    if (onProgress && visited.size % 10 === 0) {
      const progress = Math.min(Math.round((visited.size / MAX_PAGES_PER_SITE) * 100), 100)
      const totalFound = allFoundPages.size
      const notAnalyzed = Math.max(0, totalFound - visited.size - toVisit.size)
      onProgress({
        site: domain,
        total_checked: visited.size,
        total_pages_found: totalFound,
        pages_not_analyzed: notAnalyzed,
        max_pages_per_site: MAX_PAGES_PER_SITE,
        errors_404: errors.length,
        broken_links: 0, // Sera calculé en Pass 2
        errors_list: errors.slice(0, 50),
        progress_percent: Math.min(progress, 50), // Pass 1 = 50% max
        status: 'in_progress',
      })
      console.log(`  📊 Pass 1: ${visited.size}/${totalFound} pages crawlees, ${errors.length} erreurs 404/410`)
    }
  }
  
  // ========================================
  // PASS 2 : ÉVALUATION DES LIENS
  // ========================================
  
  console.log(`  🔍 Pass 2: Évaluation de ${edges.length} liens...`)
  
  const brokenLinksList: Array<{ source: string; target: string }> = []
  
  // Parcourir toutes les arêtes (liens) trouvées
  const seenLinks = new Set<string>() // Pour dédupliquer les liens cassés
  let statsNonVisited = 0
  let stats404 = 0
  let statsOther = 0
  
  for (const edge of edges) {
    // Normaliser la target et source pour s'assurer de la cohérence
    const normalizedTarget = normalizeUrl(edge.target)
    const normalizedSource = normalizeUrl(edge.source)
    const targetStatus = urlStatus.get(normalizedTarget)
    
    // Un lien est cassé SEULEMENT si :
    // 1. La cible a un statut défini (a été crawlée)
    // 2. ET ce statut est 404 ou 410
    if (targetStatus === 404 || targetStatus === 410) {
      stats404++
      // Dédupliquer : même source -> même target = un seul lien cassé
      const linkKey = `${normalizedSource} -> ${normalizedTarget}`
      
      if (!seenLinks.has(linkKey)) {
        seenLinks.add(linkKey)
        brokenLinksList.push({
          source: normalizedSource,
          target: normalizedTarget,
        })
      }
    } else if (targetStatus === undefined) {
      // URL non visitée : on ne peut pas savoir si elle est cassée, donc on ignore
      // (C'est normal si la limite de 300 pages est atteinte)
      statsNonVisited++
    } else {
      statsOther++
    }
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000)
  const totalFound = allFoundPages.size
  const notAnalyzed = Math.max(0, totalFound - visited.size)
  
  console.log(`✅ ${domain} completed: ${visited.size}/${totalFound} pages, ${errors.length} erreurs 404/410, ${brokenLinksList.length} liens cassés (${duration}s)`)
  console.log(`  📊 Stats Pass 2: ${stats404} liens vers 404/410, ${statsNonVisited} vers URLs non visitées, ${statsOther} autres statuts`)
  
  const finalResult: CrawlResult = {
    site: domain,
    total_checked: visited.size,
    total_pages_found: totalFound,
    pages_not_analyzed: notAnalyzed,
    max_pages_per_site: MAX_PAGES_PER_SITE,
    errors_404: errors.length,
    broken_links: brokenLinksList.length,
    errors_list: errors.slice(0, 50),
    broken_links_list: brokenLinksList,
    scan_date: new Date().toISOString(),
    crawl_duration: duration,
    progress_percent: 100,
    status: 'completed',
    errors_detailed: errorsDetailed,
  }
  
  // Send final progress update
  if (onProgress) {
    onProgress(finalResult)
  }
  
  return finalResult
}

export async function POST(request: NextRequest) {
  // Récupérer le paramètre site depuis le body ou query string
  let body: any = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    // Si pas de body, vérifier query params
  }
  
  const urlObj = new URL(request.url)
  const siteFilter = body.site || urlObj.searchParams.get('site') || null
  
  // Déterminer la liste des sites à crawler
  let sitesToCrawl: string[]
  if (siteFilter && siteFilter !== 'all' && SITES.includes(siteFilter)) {
    sitesToCrawl = [siteFilter]
    console.log(`🚀 Starting crawl on single site: ${siteFilter}`)
  } else {
    sitesToCrawl = SITES
    console.log(`🚀 Starting PARALLEL recursive crawl with SSE on`, SITES.length, 'sites...')
  }
  
  const overallStart = Date.now()
  const commit_sha = urlObj.searchParams.get('commit') || undefined
  const branch = urlObj.searchParams.get('branch') || undefined
  const actor = urlObj.searchParams.get('actor') || undefined
  const repo = urlObj.searchParams.get('repo') || undefined
  
  // Create a ReadableStream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      
      // Helper to send SSE event
      const sendEvent = (type: string, data: any) => {
        const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }
      
      try {
        // Send initial event with site list
        sendEvent('init', { sites: sitesToCrawl, total: sitesToCrawl.length, filter: siteFilter || 'all' })
        
        const results: CrawlResult[] = []
        
        // Crawl sites in parallel with progress callbacks
        await Promise.all(
          sitesToCrawl.map(site =>
            crawlSite(site, (progress) => {
              // Send progress event for this site
              sendEvent('progress', progress)
            }).then(result => {
              results.push(result)
            })
          )
        )
        
        const totalDuration = Math.round((Date.now() - overallStart) / 1000)
        const totalPages = results.reduce((sum, r) => sum + r.total_checked, 0)
        const totalErrors = results.reduce((sum, r) => sum + r.errors_404, 0)
        
        console.log(`✅ Crawl completed (PARALLEL): ${totalPages} pages, ${totalErrors} errors (${totalDuration}s)`)
        
        // Enregistrer dans BigQuery (historique + URLs + liens par scan)
        try {
          const scanId = randomUUID()
          const now = new Date().toISOString()
          
          console.log('💾 Enregistrement dans BigQuery...')
          console.log('[404/crawl] BigQuery config:', {
            projectId: process.env.GCP_PROJECT_ID || 'moverz-dashboard',
            dataset: process.env.BQ_DATASET || 'analytics_core',
            hasCredentials: !!process.env.GCP_SA_KEY_JSON,
          })
          
          const historyEntry = {
            id: scanId,
            scan_date: now,
            total_sites: results.length,
            total_pages_checked: totalPages,
            total_errors_404: totalErrors,
            sites_results: results.map(r => ({
              site: r.site,
              total_checked: r.total_checked,
              errors_404: r.errors_404,
            })),
            crawl_duration_seconds: totalDuration,
          }
          
          console.log('[404/crawl] Inserting history entry:', {
            id: historyEntry.id,
            scan_date: historyEntry.scan_date,
            total_sites: historyEntry.total_sites,
            total_pages_checked: historyEntry.total_pages_checked,
            total_errors_404: historyEntry.total_errors_404,
          })
          
          // 1. Historique
          await insertError404History(historyEntry)
          console.log(`✅ Historique BigQuery enregistré (ID: ${scanId})`)

          // 2. URLs 404/410 détaillées
          const urlEntries = results.flatMap(r =>
            (r.errors_detailed || []).map(e => ({ site: r.site, path: e.path, status: e.status }))
          )
          if (urlEntries.length > 0) {
            await insertError404UrlsScan({
              scan_id: scanId,
              scan_date: now,
              commit_sha,
              branch,
              actor,
              repo,
              entries: urlEntries,
            })
            console.log(`✅ URLs 404/410 sauvegardées (${urlEntries.length})`)
          }

          // 3. Liens cassés visibles par scan (source -> target)
          const brokenLinksEntries = results.flatMap(r =>
            (r.broken_links_list || []).map(l => ({ site: r.site, source: l.source, target: l.target }))
          )
          if (brokenLinksEntries.length > 0) {
            await insertBrokenLinksScan({
              scan_id: scanId,
              scan_date: now,
              commit_sha,
              branch,
              actor,
              repo,
              links: brokenLinksEntries,
            })
            console.log(`✅ Liens cassés visibles sauvegardés (${brokenLinksEntries.length})`)
          }
        } catch (error: any) {
          console.error('⚠️ Erreur lors de l\'enregistrement BigQuery:', error)
          console.error('[404/crawl] BigQuery error details:', {
            message: error.message,
            code: error.code,
            errors: error.errors,
            response: error.response,
          })
          console.error('[404/crawl] Stack:', error.stack)
          console.error('[404/crawl] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
          
          // Envoyer un événement SSE pour informer le frontend de l'erreur
          sendEvent('error', {
            type: 'bigquery_insert_failed',
            message: `Erreur lors de l'enregistrement BigQuery: ${error.message}`,
            error: error.message,
          })
          
          // Ne pas faire échouer le crawl si l'écriture BigQuery échoue
        }
        
        // Send completion event
        sendEvent('complete', {
          summary: {
            total_sites: results.length,
            total_checked: totalPages,
            total_errors: totalErrors,
            total_duration: totalDuration,
          },
          timestamp: new Date().toISOString(),
        })
        
        controller.close()
        
      } catch (error: any) {
        console.error('❌ Crawl error:', error)
        sendEvent('error', {
          message: 'Erreur lors du crawl',
          error: error.message,
        })
        controller.close()
      }
    },
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
