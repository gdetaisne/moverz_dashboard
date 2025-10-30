import { NextRequest } from 'next/server'
import * as cheerio from 'cheerio'
import { insertError404History, saveBrokenLinks } from '@/lib/json-storage'
import { randomUUID } from 'crypto'

/**
 * POST /api/404/crawl
 * Crawler récursif avec Server-Sent Events (SSE) pour affichage progressif
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
  errors_404: number
  broken_links: number
  errors_list: string[]
  broken_links_list: Array<{ source: string; target: string }>
  scan_date: string
  crawl_duration: number
  progress_percent: number
  status: 'in_progress' | 'completed'
}

type ProgressCallback = (result: Partial<CrawlResult>) => void

// Limite pour éviter les crawls trop longs
const MAX_PAGES_PER_SITE = 150
const REQUEST_TIMEOUT = 8000 // 8s timeout

async function crawlSite(
  domain: string, 
  onProgress?: ProgressCallback
): Promise<CrawlResult> {
  const startTime = Date.now()
  const visited = new Set<string>()
  const errors: string[] = []
  const brokenPages = new Set<string>() // Pages retournant 404
  const brokenLinks = new Set<string>() // Liens qui pointent vers des pages 404
  const brokenLinksList: Array<{ source: string; target: string }> = [] // Liste détaillée des liens cassés
  const toVisit: string[] = [`https://${domain}/`]
  
  console.log(`🕷️ Crawling ${domain}...`)
  
  while (toVisit.length > 0 && visited.size < MAX_PAGES_PER_SITE) {
    const url = toVisit.shift()!
    
    // Skip if already visited
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
      
      // 404 detected
      if (response.status === 404) {
        const path = new URL(url).pathname
        errors.push(path)
        brokenPages.add(path)
        console.log(`  ❌ 404: ${path}`)
        continue
      }
      
      // Only parse HTML pages
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/html')) continue
      
      // Parse HTML to find internal links
      const html = await response.text()
      const $ = cheerio.load(html)
      
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href')
        if (!href) return
        
        try {
          // Resolve relative URLs
          const absoluteUrl = new URL(href, url)
          
          // Only follow internal links (same domain)
          if (absoluteUrl.hostname === domain) {
            // Remove hash and query params for deduplication
            const cleanUrl = `${absoluteUrl.protocol}//${absoluteUrl.hostname}${absoluteUrl.pathname}`
            
            // Skip common files
            if (
              cleanUrl.endsWith('.pdf') ||
              cleanUrl.endsWith('.jpg') ||
              cleanUrl.endsWith('.png') ||
              cleanUrl.endsWith('.zip') ||
              cleanUrl.includes('/wp-admin/') ||
              cleanUrl.includes('/wp-content/')
            ) {
              return
            }
            
            // Check if we already know this page is broken
            const targetPath = absoluteUrl.pathname
            if (brokenPages.has(targetPath)) {
              brokenLinks.add(url) // Track the source page that has the broken link
              // Add to detailed list
              brokenLinksList.push({
                source: url,
                target: absoluteUrl.toString()
              })
              return // Don't add to visit queue if we know it's broken
            }
            
            // Check if this URL was already visited and was broken
            // (We check visited set before adding 404s to brokenPages, so we need to track separately)
            
            // Only add to visit queue if not visited and not broken
            if (!visited.has(cleanUrl) && !toVisit.includes(cleanUrl) && !brokenPages.has(cleanUrl)) {
              toVisit.push(cleanUrl)
            }
          }
        } catch (e) {
          // Invalid URL, skip
        }
      })
      
    } catch (error: any) {
      // Timeout or network error, skip
      if (error.name !== 'AbortError') {
        console.warn(`  ⚠️ Error fetching ${url}:`, error.message)
      }
    }
    
    // Progress update every 10 pages
    if (onProgress && visited.size % 10 === 0) {
      const progress = Math.min(Math.round((visited.size / MAX_PAGES_PER_SITE) * 100), 100)
      onProgress({
        site: domain,
        total_checked: visited.size,
        errors_404: errors.length,
        broken_links: brokenLinks.size,
        errors_list: errors.slice(0, 50),
        progress_percent: progress,
        status: 'in_progress',
      })
      console.log(`  📊 ${domain}: ${visited.size} pages crawled, ${errors.length} errors, ${brokenLinks.size} broken links (${progress}%)`)
    }
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000)
  console.log(`✅ ${domain} completed: ${visited.size} pages, ${errors.length} errors, ${brokenLinks.size} broken links (${duration}s)`)
  
  const finalResult = {
    site: domain,
    total_checked: visited.size,
    errors_404: errors.length,
    broken_links: brokenLinks.size,
    errors_list: errors.slice(0, 50), // Limit to 50 errors for display
    broken_links_list: brokenLinksList, // List of all broken links
    scan_date: new Date().toISOString(),
    crawl_duration: duration,
    progress_percent: 100,
    status: 'completed' as const,
  }
  
  // Send final progress update
  if (onProgress) {
    onProgress(finalResult)
  }
  
  return finalResult
}

export async function POST(request: NextRequest) {
  console.log('🚀 Starting PARALLEL recursive crawl with SSE on', SITES.length, 'sites...')
  const overallStart = Date.now()
  
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
        sendEvent('init', { sites: SITES, total: SITES.length })
        
        const results: CrawlResult[] = []
        
        // Crawl all sites in parallel with progress callbacks
        await Promise.all(
          SITES.map(site =>
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
        
        // Sauvegarder les liens cassés persistants
        try {
          const brokenLinksBySite = results.map(r => ({
            site: r.site,
            broken_links: r.broken_links_list || [],
            last_scan_date: r.scan_date
          }))
          
          await saveBrokenLinks(brokenLinksBySite)
          console.log('✅ Liens cassés sauvegardés pour le prochain scan')
        } catch (error: any) {
          console.error('⚠️ Erreur lors de la sauvegarde des liens cassés:', error.message)
        }
        
        // Enregistrer dans BigQuery
        try {
          const scanId = randomUUID()
          const now = new Date().toISOString()
          
          console.log('💾 Tentative d\'enregistrement dans BigQuery...')
          
          await insertError404History({
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
          })
          
          console.log(`✅ Historique enregistré dans BigQuery (ID: ${scanId})`)
        } catch (error: any) {
          console.error('⚠️ Erreur lors de l\'enregistrement BigQuery:', error.message)
          console.error('⚠️ Détails:', {
            code: error.code,
            details: error.details,
            message: error.message
          })
          
          // Ne pas faire échouer le crawl si l'enregistrement échoue
          // L'enregistrement peut échouer si :
          // 1. Table BigQuery n'existe pas (migration non appliquée)
          // 2. Credentials BigQuery manquants ou invalides
          // 3. Permissions insuffisantes
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

