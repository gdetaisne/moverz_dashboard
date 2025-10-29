import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

/**
 * POST /api/404/crawl
 * Crawler récursif : parcourt tous les liens internes de chaque site
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
  'bordeaux-demenageur.fr',
  'devis-demenageur-montpellier.fr',
]

interface CrawlResult {
  site: string
  total_checked: number
  errors_404: number
  errors_list: string[]
  scan_date: string
  crawl_duration: number
}

// Limite pour éviter les crawls trop longs
const MAX_PAGES_PER_SITE = 150
const REQUEST_TIMEOUT = 8000 // 8s timeout

async function crawlSite(domain: string): Promise<CrawlResult> {
  const startTime = Date.now()
  const visited = new Set<string>()
  const errors: string[] = []
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
            
            if (!visited.has(cleanUrl) && !toVisit.includes(cleanUrl)) {
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
    
    // Progress log every 20 pages
    if (visited.size % 20 === 0) {
      console.log(`  📊 ${domain}: ${visited.size} pages crawled, ${errors.length} errors`)
    }
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000)
  console.log(`✅ ${domain} completed: ${visited.size} pages, ${errors.length} errors (${duration}s)`)
  
  return {
    site: domain,
    total_checked: visited.size,
    errors_404: errors.length,
    errors_list: errors.slice(0, 50), // Limit to 50 errors for display
    scan_date: new Date().toISOString(),
    crawl_duration: duration,
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting PARALLEL recursive crawl on', SITES.length, 'sites...')
    const overallStart = Date.now()
    
    // 🚀 Crawl all sites in parallel for maximum speed
    const results = await Promise.all(
      SITES.map(site => crawlSite(site))
    )
    
    const totalDuration = Math.round((Date.now() - overallStart) / 1000)
    const totalPages = results.reduce((sum, r) => sum + r.total_checked, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors_404, 0)
    
    console.log(`✅ Crawl completed (PARALLEL): ${totalPages} pages, ${totalErrors} errors (${totalDuration}s)`)
    
    return NextResponse.json({
      success: true,
      data: results,
      summary: {
        total_sites: results.length,
        total_checked: totalPages,
        total_errors: totalErrors,
        total_duration: totalDuration,
      },
      timestamp: new Date().toISOString(),
    })
    
  } catch (error: any) {
    console.error('❌ Crawl error:', error)
    
    return NextResponse.json(
      {
        success: false,
        message: 'Erreur lors du crawl',
        error: error.message,
      },
      { status: 500 }
    )
  }
}

