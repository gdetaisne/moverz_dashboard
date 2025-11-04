import { NextRequest } from 'next/server'
import * as cheerio from 'cheerio'

type FetchResult = { status: number; url: string; redirected: boolean; text?: string; headers: Headers }

const TTL_MS = 10 * 60 * 1000
type CacheEntry = { expires: number; value: FetchResult }
const cache = new Map<string, CacheEntry>()

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetch(url, { redirect: 'follow', signal: controller.signal }) }
  finally { clearTimeout(timer) }
}

async function get(url: string): Promise<FetchResult> {
  const res = await fetchWithTimeout(url)
  const text = await res.text()
  return { status: res.status, url: res.url, redirected: res.redirected, text, headers: res.headers }
}

function normalizeSite(site: string): { host: string; httpsBase: string; httpBase: string; wwwBase: string; nonWwwBase: string } {
  let s = site.trim()
  if (s.startsWith('http')) { try { s = new URL(s).host } catch {} }
  const host = s
  const httpsBase = `https://${host}`
  const httpBase = `http://${host}`
  const wwwHost = host.startsWith('www.') ? host : `www.${host}`
  const nonWwwHost = host.replace(/^www\./, '')
  return { host, httpsBase, httpBase, wwwBase: `https://${wwwHost}`, nonWwwBase: `https://${nonWwwHost}` }
}

function loadCheerio(html?: string) { if (!html) return null; try { return cheerio.load(html) } catch { return null } }
function parseJsonLd($: cheerio.CheerioAPI | null): any[] {
  if (!$) return []
  const out: any[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text()
    try {
      const parsed = JSON.parse(raw)
      const pushNode = (node: any) => {
        if (!node) return
        if (Array.isArray(node)) { node.forEach(pushNode); return }
        // Aplatir @graph si présent
        if (node['@graph'] && Array.isArray(node['@graph'])) {
          node['@graph'].forEach(pushNode)
        } else {
          out.push(node)
        }
      }
      pushNode(parsed)
    } catch {
      // ignore JSON errors partiels
    }
  })
  return out
}
function getTitle($: cheerio.CheerioAPI | null): string | null { if (!$) return null; const t = $('title').first().text().trim(); return t || null }
function getMeta($: cheerio.CheerioAPI | null, name: string): string | null { if (!$) return null; const el = $(`meta[name="${name}"]`).attr('content'); return (el || '').trim() || null }
function getCanonical($: cheerio.CheerioAPI | null): string | null { if (!$) return null; const href = $('link[rel="canonical"]').attr('href'); return (href || '').trim() || null }
function getFavicons($: cheerio.CheerioAPI | null): string[] { if (!$) return []; const s = new Set<string>(); $('link[rel*="icon"]').each((_, el)=>{ const h = $(el).attr('href'); if (h) s.add(h) }); return Array.from(s) }
function isSameUrl(a: string, b: string): boolean { try { const ua = new URL(a); const ub = new URL(b); return ua.host === ub.host && ua.pathname.replace(/\/$/,'') === ub.pathname.replace(/\/$/,'') } catch { return false } }
function domainFromUrl(u: string): string | null { try { return new URL(u).host } catch { return null } }

async function fetchPSI(origin: string) {
  // Utilise PSI v5; clé optionnelle via env PSI_API_KEY
  const key = process.env.PSI_API_KEY
  const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(origin)}&category=performance&strategy=mobile${key ? `&key=${encodeURIComponent(key)}` : ''}`
  const res = await fetch(url, { next: { revalidate: 600 } })
  if (!res.ok) throw new Error('PSI error ' + res.status)
  return await res.json()
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as any
  const site = String(body.site || '')
  const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : []
  if (!site || ids.length === 0) {
    return new Response(JSON.stringify({ success: false, error: 'Missing site or ids' }), { status: 400 })
  }
  const { httpsBase, httpBase, wwwBase, nonWwwBase, host } = normalizeSite(site)

  try {
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
      // 1) Chercher une URL de sitemap dans robots.txt
      try {
        const r = await ensureRobots()
        const txt = r.text || ''
        const m = txt.match(/sitemap:\s*(https?:[^\s#]+)/i)
        if (m && m[1]) {
          try {
            sitemap = await get(m[1])
            if (sitemap.status === 200) { cache.set(key, { value: sitemap, expires: now + TTL_MS }); return sitemap }
          } catch {}
        }
      } catch {}
      // 2) Essayer les patterns standards
      const candidates = [
        `${httpsBase}/sitemap.xml`,
        `${httpsBase}/sitemap_index.xml`,
        `${httpBase}/sitemap.xml`,
        `${httpBase}/sitemap_index.xml`,
      ]
      for (const url of candidates) {
        try {
          const res = await get(url)
          if (res.status === 200 && /<(urlset|sitemapindex)[^>]*>/i.test(res.text || '')) {
            sitemap = res
            break
          }
        } catch {}
      }
      if (!sitemap) sitemap = await get(`${httpsBase}/sitemap.xml`).catch(() => get(`${httpBase}/sitemap.xml`))
      cache.set(key, { value: sitemap, expires: now + TTL_MS })
      return sitemap
    }

    async function checkOne(id: string): Promise<null | boolean> {
      switch (id) {
        case '1': { const r = await ensureRobots(); return r.status === 200 && /user-agent/i.test(r.text || '') }
        case '2': { const s = await ensureSitemap(); return s.status === 200 && /<(urlset|sitemapindex)[^>]*>/i.test(s.text || '') }
        case '3': { const r = await ensureRobots(); return r.status === 200 && /sitemap:\s*https?:\/\//i.test(r.text || '') }
        case '5': { const h = await ensureHome(); const $ = loadCheerio(h.text); const m = getMeta($,'robots')?.toLowerCase() || ''; return !/noindex|nofollow/.test(m) }
        case '6': { const h = await ensureHome(); const $ = loadCheerio(h.text); const m = getMeta($,'robots')?.toLowerCase() || ''; if (!m) return true; return /index/.test(m) && /follow/.test(m) }
        case '7': { const h = await ensureHome(); const $ = loadCheerio(h.text); return !!getCanonical($) }
        case '8': { const h = await ensureHome(); const $ = loadCheerio(h.text); const c = getCanonical($); if (!c) return false; return isSameUrl(c, h.url) }
        case '9': { const h = await ensureHome(); const $ = loadCheerio(h.text); const c = getCanonical($); if (!c) return null; try { const hc = new URL(c); const hu = new URL(h.url); return (/\/$/.test(hc.pathname)) === (/\/$/.test(hu.pathname)) } catch { return null } }
        case '10': { try { const r = await fetchWithTimeout(httpBase); return (r.status === 301 || r.status === 308) || r.redirected } catch { return null } }
        case '11': { try { const r = await fetchWithTimeout(httpsBase); return r.status >= 200 && r.status < 400 } catch { return false } }
        case '12': { try { const a = await fetchWithTimeout(wwwBase); const b = await fetchWithTimeout(nonWwwBase); return a.redirected || b.redirected || a.status === 301 || b.status === 301 || a.status === 308 || b.status === 308 } catch { return null } }
        case '13': { const h = await ensureHome(); try { return new URL(h.url).search === '' } catch { return null } }
        case '15': { const h = await ensureHome(); const $ = loadCheerio(h.text); const links = $('link[rel="alternate"][hreflang]'); if (links.length === 0) return null; let ok = true; links.each((_,el)=>{ const v = ($(el).attr('hreflang')||'').trim(); if (!/^([a-z]{2})(-[A-Z]{2})?$/.test(v)) ok = false }); return ok }
        case '19': { const h = await ensureHome(); return h.status === 200 }
        case '26': { const h = await ensureHome(); const $ = loadCheerio(h.text); return !!getTitle($) }
        case '27': { const h = await ensureHome(); const $ = loadCheerio(h.text); const t = getTitle($)||''; return t.length >= 50 && t.length <= 60 }
        case '28': return null
        case '29': { const h = await ensureHome(); const $ = loadCheerio(h.text); return !!getMeta($,'description') }
        case '30': { const h = await ensureHome(); const $ = loadCheerio(h.text); const d = getMeta($,'description')||''; return d.length >= 150 && d.length <= 160 }
        case '31': { const h = await ensureHome(); const $ = loadCheerio(h.text); return $('meta[name="keywords"]').length === 0 }
        case '32': { const h = await ensureHome(); const $ = loadCheerio(h.text); const ogt = $('meta[property="og:title"]').attr('content'); const ogi = $('meta[property="og:image"]').attr('content'); return !!(ogt && ogi) }
        case '33': { const h = await ensureHome(); const $ = loadCheerio(h.text); return $('meta[name="twitter:card"]').length > 0 }
        case '34': { const h = await ensureHome(); const $ = loadCheerio(h.text); return getFavicons($).length > 0 }
        case '35': { const h = await ensureHome(); const $ = loadCheerio(h.text); return $('meta[name="viewport"]').length > 0 }
        case '36': { const h = await ensureHome(); const $ = loadCheerio(h.text); return $('h1').length === 1 }
        case '37': return null
        case '38': { const h = await ensureHome(); const $ = loadCheerio(h.text); const imgs = $('img'); if (imgs.length === 0) return true; const missing = imgs.filter((_,el)=>!($(el).attr('alt')||'').trim()).length; return missing === 0 }
        case '40': { const h = await ensureHome(); const $ = loadCheerio(h.text); return $('img[loading="lazy"]').length > 0 }
        case '41': { const h = await ensureHome(); const $ = loadCheerio(h.text); const host = domainFromUrl(h.url); let count = 0; $('a[href]').each((_,el)=>{ const href = ($(el).attr('href')||'').trim(); if (!href) return; try { const u = new URL(href, h.url); if (u.host === host) count++ } catch {} }); return count >= 3 }
        case '43': { const h = await ensureHome(); const $ = loadCheerio(h.text); const host = domainFromUrl(h.url); let count = 0; $('a[href]').each((_,el)=>{ const href = ($(el).attr('href')||'').trim(); if (!href) return; try { const u = new URL(href, h.url); if (u.host && host && u.host !== host) count++ } catch {} }); return count >= 1 }
        case '44': return null
        case '46': { const h = await ensureHome(); const $ = loadCheerio(h.text); const jsonld = parseJsonLd($); const hasSchema = jsonld.some((b)=> b['@type']==='BreadcrumbList'); const hasNav = $('nav[aria-label="breadcrumb"]').length > 0; return hasSchema || hasNav }
        case '48': { const h = await ensureHome(); const $ = loadCheerio(h.text); return $('footer a[href]').length > 0 }
        
        // Performance & Core Web Vitals (PSI)
        case '66': // Score > 90
        case '67': // LCP < 2.5s
        case '68': // INP < 200ms (field metric si dispo, sinon audit lighthouse)
        case '69': // CLS < 0.1
        case '70': // TTFB < 600ms
        case '71': // Compression
        case '72': // Minification CSS/JS
        case '74': { // Caching
          try {
            const psi = await fetchPSI(httpsBase)
            const lr = psi.lighthouseResult
            const le = psi.loadingExperience || psi.originLoadingExperience || {}
            const metrics = (lr?.audits?.metrics?.details?.items?.[0]) || {}
            const audits = lr?.audits || {}

            if (id === '66') {
              const perf = lr?.categories?.performance?.score
              return typeof perf === 'number' ? perf >= 0.9 : null
            }
            if (id === '67') {
              // LCP lab metric (seconds)
              let lcp = metrics.largestContentfulPaint || metrics.lcp || audits['largest-contentful-paint']?.numericValue / 1000
              if (typeof lcp === 'number') return lcp < 2.5
              // fallback field metric (ms)
              const fld = le?.metrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile
              return typeof fld === 'number' ? fld < 2500 : null
            }
            if (id === '68') {
              // Field (CrUX): INTERACTION_TO_NEXT_PAINT_MS (percentile)
              const inp = le?.metrics?.INTERACTION_TO_NEXT_PAINT_MS?.percentile
              if (typeof inp === 'number') return inp < 200
              // Fallback lab audit (ms)
              const inpLab = audits['interaction-to-next-paint']?.numericValue
              return typeof inpLab === 'number' ? inpLab < 200 : null
            }
            if (id === '69') {
              const clsLab = audits['cumulative-layout-shift']?.numericValue
              if (typeof clsLab === 'number') return clsLab < 0.1
              const clsFld = le?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
              return typeof clsFld === 'number' ? clsFld < 0.1 : null
            }
            if (id === '70') {
              const ttfbFld = le?.metrics?.EXPERIMENTAL_TIME_TO_FIRST_BYTE_MS?.percentile
              if (typeof ttfbFld === 'number') return ttfbFld < 600
              const ttfbLab = audits['server-response-time']?.numericValue
              return typeof ttfbLab === 'number' ? ttfbLab < 600 : null
            }
            if (id === '71') {
              const comp = audits['uses-text-compression']?.score
              return typeof comp === 'number' ? comp === 1 : null
            }
            if (id === '72') {
              const css = audits['unminified-css']?.score
              const js = audits['unminified-javascript']?.score
              if (typeof css === 'number' && typeof js === 'number') return css === 1 && js === 1
              return null
            }
            if (id === '74') {
              const cache = audits['uses-long-cache-ttl']?.score
              return typeof cache === 'number' ? cache === 1 : null
            }
          } catch {
            return null
          }
        }

        // Nouveaux tests
        case '101': { // HSTS présent
          try {
            const h = await ensureHome()
            const hsts = h.headers.get('strict-transport-security')
            return !!hsts
          } catch { return null }
        }
        case '102': { // CrUX Good (LCP/CLS/INP)
          try {
            const psi = await fetchPSI(httpsBase)
            const le = psi.loadingExperience || psi.originLoadingExperience || {}
            const lcp = le?.metrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile
            const cls = le?.metrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
            const inp = le?.metrics?.INTERACTION_TO_NEXT_PAINT_MS?.percentile
            if (typeof lcp !== 'number' || typeof cls !== 'number' || typeof inp !== 'number') return null
            return lcp < 2500 && cls < 0.1 && inp < 200
          } catch { return null }
        }
        case '103': { // Sitemap lastmod présent (majorité)
          try {
            const s = await ensureSitemap()
            if (s.status !== 200 || !s.text) return null
            const txt = s.text || ''
            if (/<sitemapindex/i.test(txt)) {
              const smCount = (txt.match(/<sitemap>/gi) || []).length || 1
              const lastmodCount = (txt.match(/<lastmod>[^<]+<\/lastmod>/gi) || []).length
              const ratio = lastmodCount / smCount
              return lastmodCount > 0 && ratio >= 0.5
            } else {
              const urlCount = (txt.match(/<url>/gi) || []).length || 1
              const lastmodCount = (txt.match(/<lastmod>[^<]+<\/lastmod>/gi) || []).length
              const ratio = lastmodCount / urlCount
              return lastmodCount > 0 && ratio >= 0.5
            }
          } catch { return null }
        }
        case '104': { // og:url == canonical
          const h = await ensureHome()
          const $ = loadCheerio(h.text)
          const og = $('meta[property="og:url"]').attr('content')
          const can = getCanonical($)
          if (!og || !can) return null
          try {
            const uo = new URL(og, h.url)
            const uc = new URL(can, h.url)
            const po = uo.pathname.replace(/\/$/, '')
            const pc = uc.pathname.replace(/\/$/, '')
            return uo.host === uc.host && po === pc
          } catch { return null }
        }
        case '86': { const h = await ensureHome(); const $ = loadCheerio(h.text); const jsonld = parseJsonLd($); return jsonld.length > 0 }
        case '87': return null
        case '88': { const h = await ensureHome(); const $ = loadCheerio(h.text); const jsonld = parseJsonLd($); return jsonld.some((b)=> b['@type']==='BreadcrumbList') }
        case '89': { const h = await ensureHome(); const $ = loadCheerio(h.text); const jsonld = parseJsonLd($); return jsonld.some((b)=> b['@type']==='FAQPage') }
        case '90': { const h = await ensureHome(); const $ = loadCheerio(h.text); const jsonld = parseJsonLd($); return jsonld.some((b)=> b['@type']==='Product' || b['@type']==='Review' || !!b['aggregateRating']) }
        case '96': { const h = await ensureHome(); const $ = loadCheerio(h.text); const scripts: string[] = []; $('script[src]').each((_,el)=>{ const s = $(el).attr('src'); if (s) scripts.push(s) }); const inline: string[] = []; $('script:not([src])').each((_,el)=>{ inline.push($(el).text()) }); const hasGtagSrc = scripts.some((s)=>/googletagmanager\.com\/gtag\/js\?id=G-/.test(s)); const hasGtagInit = inline.some((t)=>/gtag\(\s*["']config["']\s*,\s*["']G-/.test(t)); return hasGtagSrc || hasGtagInit }
        case '97': { const h = await ensureHome(); const $ = loadCheerio(h.text); return $('meta[name="google-site-verification"]').length > 0 }
        case '99': { const h = await ensureHome(); const $ = loadCheerio(h.text); const scripts: string[] = []; $('script[src]').each((_,el)=>{ const s = $(el).attr('src'); if (s) scripts.push(s) }); const inline: string[] = []; $('script:not([src])').each((_,el)=>{ inline.push($(el).text()) }); const hasHotjarSrc = scripts.some((s)=>/static\.hotjar\.com|hotjar\.com/.test(s)); const hasHotjarInit = inline.some((t)=>/hj\s*\(|window\.hj/.test(t)); return hasHotjarSrc || hasHotjarInit }
        default: return null
      }
    }

    const results: Record<string, boolean | null> = {}
    // Exécuter en série, mais mutualise les fetch via ensure* (déjà en cache mémoire)
    for (const id of ids) {
      results[id] = await checkOne(id)
    }
    return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 })
  }
}


