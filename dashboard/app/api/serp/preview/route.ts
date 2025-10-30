import { NextRequest, NextResponse } from 'next/server'
import { getTopPages, getTotalImpressionsLast30Days } from '@/lib/bigquery'

export const dynamic = 'force-dynamic'

type SerpPreview = {
  url: string
  title: string | null
  description: string | null
  favicon: string | null
  hasFAQ: boolean
  hasAggregateRating: boolean
  hasBreadcrumb: boolean
  impressions: number
  sharePct: number
}

function extractBetween(content: string, start: string, end: string): string | null {
  const s = content.toLowerCase().indexOf(start.toLowerCase())
  if (s === -1) return null
  const e = content.indexOf(end, s + start.length)
  if (e === -1) return null
  return content.slice(s + start.length, e)
}

function parseHtmlForSerp(html: string, pageUrl: string, impressions: number, sharePct: number): SerpPreview {
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

  // JSON-LD detection
  let hasFAQ = false
  let hasAggregateRating = false
  let hasBreadcrumb = false
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
        }
      } catch {}
    }
  } catch {}

  return { url: pageUrl, title, description, favicon, hasFAQ, hasAggregateRating, hasBreadcrumb, impressions, sharePct }
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
          try {
            const res = await fetch(pageUrl, { headers: { 'user-agent': 'Mozilla/5.0 (SERP-Preview Bot)' }, cache: 'no-store' })
            const html = await res.text()
            const impressions = Number(p.impressions || 0)
            const sharePct = totalImpr > 0 ? (impressions / totalImpr) * 100 : 0
            return parseHtmlForSerp(html, pageUrl, impressions, sharePct)
          } catch (e) {
            const impressions = Number(p.impressions || 0)
            const sharePct = totalImpr > 0 ? (impressions / totalImpr) * 100 : 0
            return { url: pageUrl, title: null, description: null, favicon: null, hasFAQ: false, hasAggregateRating: false, hasBreadcrumb: false, impressions, sharePct }
          }
        })
      )
      results.push(...previews)
    }

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


