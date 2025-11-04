import { NextRequest } from 'next/server'
import * as cheerio from 'cheerio'

// Cache mémoire simple (TTL 10 min) pour éviter les refetch multiples en rafale
const TTL_MS = 10 * 60 * 1000
type CacheEntry = { expires: number; value: FetchResult }
const cache = new Map<string, CacheEntry>()

type FetchResult = {
  status: number
  url: string
  redirected: boolean
  text?: string
  headers: Headers
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

async function get(url: string): Promise<FetchResult> {
  const res = await fetchWithTimeout(url)
  const text = await res.text()
  return {
    status: res.status,
    url: res.url,
    redirected: res.redirected,
    text,
    headers: res.headers,
  }
}

async function head(url: string): Promise<FetchResult> {
  const res = await fetchWithTimeout(url)
  return {
    status: res.status,
    url: res.url,
    redirected: res.redirected,
    headers: res.headers,
  }
}

function normalizeSite(site: string): { host: string; httpsBase: string; httpBase: string; wwwBase: string; nonWwwBase: string } {
  let s = site.trim()
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try { s = new URL(s).host } catch {}
  }
  const host = s
  const httpsBase = `https://${host}`
  const httpBase = `http://${host}`
  const wwwHost = host.startsWith('www.') ? host : `www.${host}`
  const nonWwwHost = host.replace(/^www\./, '')
  return {
    host,
    httpsBase,
    httpBase,
    wwwBase: `https://${wwwHost}`,
    nonWwwBase: `https://${nonWwwHost}`,
  }
}

function loadCheerio(html?: string) {
  if (!html) return null
  try { return cheerio.load(html) } catch { return null }
}

function parseJsonLd($: cheerio.CheerioAPI | null): any[] {
  if (!$) return []
  const blocks: any[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text()
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) blocks.push(...parsed)
      else blocks.push(parsed)
    } catch {
      // ignore JSON errors
    }
  })
  return blocks
}

function getTitle($: cheerio.CheerioAPI | null): string | null {
  if (!$) return null
  const t = $('title').first().text().trim()
  return t || null
}

function getMeta($: cheerio.CheerioAPI | null, name: string): string | null {
  if (!$) return null
  const el = $(`meta[name="${name}"]`).attr('content')
  return (el || '').trim() || null
}

function getCanonical($: cheerio.CheerioAPI | null): string | null {
  if (!$) return null
  const href = $('link[rel="canonical"]').attr('href')
  return (href || '').trim() || null
}

function getFavicons($: cheerio.CheerioAPI | null): string[] {
  if (!$) return []
  const hrefs = new Set<string>()
  $('link[rel*="icon"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href) hrefs.add(href)
  })
  return Array.from(hrefs)
}

function isSameUrl(a: string, b: string): boolean {
  try {
    const ua = new URL(a)
    const ub = new URL(b)
    const pa = ua.pathname.replace(/\/$/, '')
    const pb = ub.pathname.replace(/\/$/, '')
    return ua.host === ub.host && pa === pb
  } catch {
    return false
  }
}

function domainFromUrl(u: string): string | null {
  try { return new URL(u).host } catch { return null }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') || ''
  const site = searchParams.get('site') || ''
  if (!id || !site) {
    return new Response(JSON.stringify({ success: false, error: 'Missing id or site' }), { status: 400 })
  }

  const { httpsBase, httpBase, wwwBase, nonWwwBase, host } = normalizeSite(site)

  try {
    // Pre-fetch commonly used resources lazily when needed
    let home: FetchResult | null = null
    let robots: FetchResult | null = null
    let sitemap: FetchResult | null = null

    async function ensureHome() {
      if (home) return home
      const key = `home:${host}`
      const now = Date.now()
      const hit = cache.get(key)
      if (hit && hit.expires > now) { home = hit.value; return home }
      try { home = await get(httpsBase) } catch { home = await get(httpBase) }
      cache.set(key, { value: home, expires: now + TTL_MS })
      return home
    }

    async function ensureRobots() {
      if (robots) return robots
      const key = `robots:${host}`
      const now = Date.now()
      const hit = cache.get(key)
      if (hit && hit.expires > now) { robots = hit.value; return robots }
      try { robots = await get(`${httpsBase}/robots.txt`) } catch { robots = await get(`${httpBase}/robots.txt`) }
      cache.set(key, { value: robots, expires: now + TTL_MS })
      return robots
    }

    async function ensureSitemap() {
      if (sitemap) return sitemap
      const key = `sitemap:${host}`
      const now = Date.now()
      const hit = cache.get(key)
      if (hit && hit.expires > now) { sitemap = hit.value; return sitemap }
      try { sitemap = await get(`${httpsBase}/sitemap.xml`) } catch { sitemap = await get(`${httpBase}/sitemap.xml`) }
      cache.set(key, { value: sitemap, expires: now + TTL_MS })
      return sitemap
    }

    async function check(id: string): Promise<null | boolean> {
      switch (id) {
        // Robots / Sitemap
        case '1': { // robots.txt présent
          const r = await ensureRobots()
          return r.status === 200 && /user-agent/i.test(r.text || '')
        }
        case '2': { // sitemap présent/valide (structure de base)
          const s = await ensureSitemap()
          return s.status === 200 && /<(urlset|sitemapindex)[^>]*>/i.test(s.text || '')
        }
        case '3': { // directive Sitemap dans robots
          const r = await ensureRobots()
          return r.status === 200 && /sitemap:\s*https?:\/\//i.test(r.text || '')
        }

        // Technique
        case '5': { // noindex accidentel (home)
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const robotsMeta = getMeta($, 'robots')?.toLowerCase() || ''
          return !/noindex|nofollow/.test(robotsMeta)
        }
        case '6': { // meta robots corrects (index, follow ou absent)
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const robotsMeta = getMeta($, 'robots')?.toLowerCase() || ''
          if (!robotsMeta) return true
          return /index/.test(robotsMeta) && /follow/.test(robotsMeta)
        }
        case '7': { // canonical présent
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const c = getCanonical($)
          return !!c
        }
        case '8': { // canonical self-reference approximatif
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const c = getCanonical($)
          if (!c) return false
          return isSameUrl(c, h.url)
        }
        case '9': { // trailing slash cohérent via canonical vs URL finale
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const c = getCanonical($)
          if (!c) return null
          try {
            const hc = new URL(c)
            const hu = new URL(h.url)
            const cHasSlash = /\/$/.test(hc.pathname)
            const uHasSlash = /\/$/.test(hu.pathname)
            return cHasSlash === uHasSlash
          } catch { return null }
        }
        case '10': { // redirection http -> https (basique)
          try {
            const r = await head(httpBase)
            return (r.status === 301 || r.status === 308) || r.redirected
          } catch { return null }
        }
        case '11': { // HTTPS OK
          try {
            const r = await head(httpsBase)
            return r.status >= 200 && r.status < 400
          } catch { return false }
        }
        case '12': { // WWW vs non-WWW cohérent (une redirige vers l'autre)
          try {
            const a = await head(wwwBase)
            const b = await head(nonWwwBase)
            return a.redirected || b.redirected || a.status === 301 || b.status === 301 || a.status === 308 || b.status === 308
          } catch { return null }
        }
        case '13': { // URL propre (home sans query)
          const h = await ensureHome()
          try { return new URL(h.url).search === '' } catch { return null }
        }
        case '15': { // hreflang (si présent, basique)
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const links = $('link[rel="alternate"][hreflang]')
          if (links.length === 0) return null
          let ok = true
          links.each((_, el) => {
            const v = ($(el).attr('hreflang') || '').trim()
            if (!/^([a-z]{2})(-[A-Z]{2})?$/.test(v)) ok = false
          })
          return ok
        }
        case '19': { // Réponse 200 en final
          const h = await ensureHome()
          return h.status === 200
        }

        // On-page
        case '26': { // Title présent
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          return !!getTitle($)
        }
        case '27': { // Title length 50–60
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const t = getTitle($) || ''
          return t.length >= 50 && t.length <= 60
        }
        case '28': { // Keywords en début de title – non testable automatiquement de manière fiable
          return null
        }
        case '29': { // Meta description présente
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const d = getMeta($, 'description')
          return !!d
        }
        case '30': { // Description length 150–160
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const d = getMeta($, 'description') || ''
          return d.length >= 150 && d.length <= 160
        }
        case '31': { // Meta keywords supprimées
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          return $('meta[name="keywords"]').length === 0
        }
        case '32': { // Open Graph de base
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const ogTitle = $('meta[property="og:title"]').attr('content')
          const ogImage = $('meta[property="og:image"]').attr('content')
          return !!(ogTitle && ogImage)
        }
        case '33': { // Twitter Card
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          return $('meta[name="twitter:card"]').length > 0
        }
        case '34': { // Favicon présent
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          return getFavicons($).length > 0
        }
        case '35': { // Viewport meta
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          return $('meta[name="viewport"]').length > 0
        }
        case '36': { // H1 unique
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          return $('h1').length === 1
        }
        case '37': { // Hiérarchie Hn – hors périmètre simple
          return null
        }
        case '38': { // Alt text images (ratio 100%)
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const imgs = $('img')
          if (imgs.length === 0) return true
          const missing = imgs.filter((_, el) => !($(el).attr('alt') || '').trim()).length
          return missing === 0
        }
        case '40': { // Lazy loading images
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          return $('img[loading="lazy"]').length > 0
        }
        case '41': { // Liens internes ≥ 3
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const host = domainFromUrl(h.url)
          let count = 0
          $('a[href]').each((_, el) => {
            const href = ($(el).attr('href') || '').trim()
            if (!href) return
            try {
              const u = new URL(href, h.url)
              if (u.host === host) count++
            } catch {}
          })
          return count >= 3
        }
        case '43': { // Liens externes ≥ 1
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const host = domainFromUrl(h.url)
          let count = 0
          $('a[href]').each((_, el) => {
            const href = ($(el).attr('href') || '').trim()
            if (!href) return
            try {
              const u = new URL(href, h.url)
              if (u.host && host && u.host !== host) count++
            } catch {}
          })
          return count >= 1
        }
        case '44': { // Nofollow sponsorisé/UGC – hors périmètre simple
          return null
        }
        case '46': { // Breadcrumbs (JSON-LD ou nav)
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const jsonld = parseJsonLd($)
          const hasSchema = jsonld.some((b) => (b['@type'] === 'BreadcrumbList'))
          const hasNav = $('nav[aria-label="breadcrumb"]').length > 0
          return hasSchema || hasNav
        }
        case '48': { // Footer links
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          return $('footer a[href]').length > 0
        }

        // Schema.org
        case '86': { // Markup présent
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const jsonld = parseJsonLd($)
          return jsonld.length > 0
        }
        case '87': { // Rich Results Test – non faisable sans API externe
          return null
        }
        case '88': { // Breadcrumb schema
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const jsonld = parseJsonLd($)
          return jsonld.some((b) => (b['@type'] === 'BreadcrumbList'))
        }
        case '89': { // FAQ schema
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const jsonld = parseJsonLd($)
          return jsonld.some((b) => (b['@type'] === 'FAQPage'))
        }
        case '90': { // Review schema / AggregateRating
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const jsonld = parseJsonLd($)
          return jsonld.some((b) => b['@type'] === 'Product' || b['@type'] === 'Review' || !!b['aggregateRating'])
        }

        // Analytics
        case '96': { // GA4 (gtag/G-)
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const scripts: string[] = []
          $('script[src]').each((_, el) => { const s = $(el).attr('src'); if (s) scripts.push(s) })
          const inline: string[] = []
          $('script:not([src])').each((_, el) => { inline.push($(el).text()) })
          const hasGtagSrc = scripts.some((s) => /googletagmanager\.com\/gtag\/js\?id=G-/.test(s))
          const hasGtagInit = inline.some((t) => /gtag\(\s*'config'\s*,\s*'G-/.test(t))
          return hasGtagSrc || hasGtagInit
        }
        case '97': { // Search Console verification
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          return $('meta[name="google-site-verification"]').length > 0
        }
        case '99': { // Heatmaps (Hotjar par ex.)
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const scripts: string[] = []
          $('script[src]').each((_, el) => { const s = $(el).attr('src'); if (s) scripts.push(s) })
          const inline: string[] = []
          $('script:not([src])').each((_, el) => { inline.push($(el).text()) })
          const hasHotjarSrc = scripts.some((s) => /static\.hotjar\.com|hotjar\.com/.test(s))
          const hasHotjarInit = inline.some((t) => /hj\(\'|window\.hj/.test(t))
          return hasHotjarSrc || hasHotjarInit
        }

        default:
          return null
      }
    }

    const result = await check(id)
    if (result === null) {
      return new Response(JSON.stringify({ success: false, error: 'Not applicable' }), { status: 501 })
    }
    return new Response(JSON.stringify({ success: true, ok: !!result }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 })
  }
}



