import { NextRequest, NextResponse } from 'next/server'
import { getTopPages } from '@/lib/bigquery'
import { getCTRBenchmarksByIntent, inferIntentFromContent, calculateIntentMatchScore, calculateLengthScore } from '@/lib/serp-utils'

export const dynamic = 'force-dynamic'
// Note: maxDuration est supporté depuis Next.js 14.1+, mais peut causer des erreurs de build
// Si erreur persiste, retirer cette ligne et gérer le timeout dans le code
// export const maxDuration = 300

type AuditResult = {
  summary: {
    total_pages: number
    crawled: number
    failed: number
    failed_pages: Array<{ url: string; reason: string }>
    duration_seconds: number
  }
  meta_formats: {
    title_missing: number
    description_missing: number
    title_too_long: number // >55
    description_too_long: number // >150
    title_optimal: number
    description_optimal: number
    both_optimal: number
  }
  rich_results: {
    total_with_faq: number
    total_with_rating: number
    total_with_breadcrumb: number
    total_with_howto: number
    total_with_article: number
    total_with_video: number
    total_with_localbusiness: number
    total_with_none: number
    avg_score: number
  }
  intent_analysis: {
    declared_meta: number
    declared_jsonld: number
    inferred: number
    missing: number
    mismatch_count: number // intent déclaré ≠ déduit
    mismatch_rate: number
  }
  performance: {
    avg_ctr: number
    avg_position: number
    pages_below_benchmark: number // CTR < benchmark pour leur intent
    top_performers: Array<{ url: string; ctr: number; intent: string }>
    underperformers: Array<{ url: string; ctr: number; intent: string; benchmark: number }>
  }
  recommendations: Array<{
    severity: 'high' | 'medium' | 'low'
    category: string
    title: string
    description: string
    affected_pages: number
    examples?: string[]
  }>
  pages: Array<{
    url: string
    title_length: number | null
    description_length: number | null
    has_title: boolean
    has_description: boolean
    intent: string | null
    intent_source: string | null
    ctr: number | null
    position: number | null
    score_length: number
    score_rich_results: number
    rich_results_types: string[]
  }>
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const site = searchParams.get('site') || undefined
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  try {
    console.log(`🔍 Démarrage audit SERP${site ? ` (site: ${site})` : ''}, limite: ${limit}`)
    
    // 1. Récupérer les pages selon la sélection actuelle
    const pages = await getTopPages(site, limit)
    console.log(`📊 ${pages.length} pages récupérées depuis GSC`)
    
    // 2. Récupérer les benchmarks CTR par intent
    const benchmarks = await getCTRBenchmarksByIntent(site)
    console.log(`📈 Benchmarks CTR par intent:`, benchmarks)
    
    // 3. Crawl toutes les pages (réutiliser la logique de preview)
    const concurrency = 10 // Plus de parallélisme pour l'audit
    const crawled: any[] = []
    const failed: Array<{ url: string; reason: string }> = []
    
    // Fonction de fetch simplifiée pour l'audit
    async function fetchPage(page: any) {
      const pageUrl: string = page.page || page.url
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000) // 8s timeout pour audit
        
        const res = await fetch(pageUrl, {
          headers: { 'user-agent': 'Mozilla/5.0 (SERP-Audit Bot)' },
          cache: 'no-store',
          redirect: 'follow',
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!res.ok) {
          failed.push({ url: pageUrl, reason: `HTTP ${res.status}` })
          return null
        }
        
        const html = await res.text()
        
        // Parser avec la même logique que preview
        // Pour simplifier, on parse directement ici
        const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || null
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)
        const description = descMatch?.[0]?.match(/content=["']([^"']+)["']/i)?.[1]?.replace(/\s+/g, ' ').trim() || null
        
        // Intent
        const intentFromMeta = html.match(/<meta[^>]+name=["'](?:intent|search-intent)["'][^>]*>/i)?.[0]?.match(/content=["']([^"']+)["']/i)?.[1]?.trim() || null
        let intentFromJsonLd: string | null = null
        const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
        for (const match of jsonLdBlocks) {
          try {
            const data = JSON.parse(match[1])
            const items = Array.isArray(data) ? data : [data]
            for (const it of items) {
              if (it.intent || it.searchIntent) {
                intentFromJsonLd = (it.intent || it.searchIntent)?.toString().trim() || null
                break
              }
            }
          } catch {}
        }
        
        const intentDeclared = intentFromMeta || intentFromJsonLd || null
        const intentInferred = inferIntentFromContent(pageUrl, title, description)
        const intent = intentDeclared || intentInferred || null
        const intentSource = intentFromMeta ? 'meta' : (intentFromJsonLd ? 'jsonld' : (intentInferred ? 'inferred' : null))
        const intentMatchScore = calculateIntentMatchScore(intentDeclared, intentInferred)
        
        // Rich Results
        let hasFAQ = false, hasAggregateRating = false, hasBreadcrumb = false
        let hasHowTo = false, hasArticle = false, hasVideo = false, hasLocalBusiness = false
        const richResultsTypes: string[] = []
        
        for (const match of jsonLdBlocks) {
          try {
            const data = JSON.parse(match[1])
            const items = Array.isArray(data) ? data : [data]
            for (const it of items) {
              const type = (it['@type'] || it.type || '').toString().toLowerCase()
              if (type.includes('faqpage')) { hasFAQ = true; richResultsTypes.push('FAQ') }
              if (type.includes('breadcrumblist')) { hasBreadcrumb = true; richResultsTypes.push('Breadcrumb') }
              if (it.aggregateRating || type.includes('aggregateRating'.toLowerCase())) { hasAggregateRating = true; richResultsTypes.push('Rating') }
              if (type.includes('howto')) { hasHowTo = true; richResultsTypes.push('HowTo') }
              if (type.includes('article') || type.includes('blogposting')) { hasArticle = true; richResultsTypes.push('Article') }
              if (type.includes('videoobject')) { hasVideo = true; richResultsTypes.push('Video') }
              if (type.includes('localbusiness')) { hasLocalBusiness = true; richResultsTypes.push('LocalBusiness') }
            }
          } catch {}
        }
        
        const richResultsCount = [hasFAQ, hasAggregateRating, hasBreadcrumb, hasHowTo, hasArticle, hasVideo, hasLocalBusiness].filter(Boolean).length
        const scoreRichResults = (richResultsCount / 7) * 100
        
        const scoreLength = calculateLengthScore(title, description)
        
        return {
          url: pageUrl,
          title_length: title ? title.length : null,
          description_length: description ? description.length : null,
          has_title: !!title,
          has_description: !!description,
          intent,
          intent_source: intentSource,
          intent_match_score: intentMatchScore,
          ctr: page.ctr || null,
          position: page.position || null,
          score_length: scoreLength,
          score_rich_results: scoreRichResults,
          rich_results_types: [...new Set(richResultsTypes)],
          has_faq: hasFAQ,
          has_rating: hasAggregateRating,
          has_breadcrumb: hasBreadcrumb,
          has_howto: hasHowTo,
          has_article: hasArticle,
          has_video: hasVideo,
          has_localbusiness: hasLocalBusiness,
        }
      } catch (e: any) {
        const reason = e.name === 'AbortError' ? 'Timeout (>8s)' : e.message || 'Erreur réseau'
        failed.push({ url: pageUrl, reason })
        return null
      }
    }
    
    // Crawl par chunks
    for (let i = 0; i < pages.length; i += concurrency) {
      const chunk = pages.slice(i, i + concurrency)
      const results = await Promise.all(chunk.map(p => fetchPage(p)))
      crawled.push(...results.filter(Boolean))
      console.log(`📊 Progression: ${crawled.length}/${pages.length} pages crawlees`)
    }
    
    console.log(`✅ Crawl terminé: ${crawled.length} succès, ${failed.length} échecs`)
    
    // 4. Analyse et regroupement
    const meta_formats = {
      title_missing: crawled.filter(p => !p.has_title).length,
      description_missing: crawled.filter(p => !p.has_description).length,
      title_too_long: crawled.filter(p => p.title_length && p.title_length > 55).length,
      description_too_long: crawled.filter(p => p.description_length && p.description_length > 150).length,
      title_optimal: crawled.filter(p => p.title_length && p.title_length <= 55).length,
      description_optimal: crawled.filter(p => p.description_length && p.description_length <= 150).length,
      both_optimal: crawled.filter(p => p.title_length && p.title_length <= 55 && p.description_length && p.description_length <= 150).length,
    }
    
    const rich_results = {
      total_with_faq: crawled.filter(p => p.has_faq).length,
      total_with_rating: crawled.filter(p => p.has_rating).length,
      total_with_breadcrumb: crawled.filter(p => p.has_breadcrumb).length,
      total_with_howto: crawled.filter(p => p.has_howto).length,
      total_with_article: crawled.filter(p => p.has_article).length,
      total_with_video: crawled.filter(p => p.has_video).length,
      total_with_localbusiness: crawled.filter(p => p.has_localbusiness).length,
      total_with_none: crawled.filter(p => p.rich_results_types.length === 0).length,
      avg_score: crawled.length > 0 ? crawled.reduce((sum, p) => sum + p.score_rich_results, 0) / crawled.length : 0,
    }
    
    const intent_analysis = {
      declared_meta: crawled.filter(p => p.intent_source === 'meta').length,
      declared_jsonld: crawled.filter(p => p.intent_source === 'jsonld').length,
      inferred: crawled.filter(p => p.intent_source === 'inferred').length,
      missing: crawled.filter(p => !p.intent).length,
      mismatch_count: crawled.filter(p => p.intent_match_score < 100 && p.intent_match_score !== 50).length,
      mismatch_rate: crawled.length > 0 ? (crawled.filter(p => p.intent_match_score < 100 && p.intent_match_score !== 50).length / crawled.length) * 100 : 0,
    }
    
    // Performance analysis
    const pagesWithCTR = crawled.filter(p => p.ctr !== null)
    const avg_ctr = pagesWithCTR.length > 0 ? pagesWithCTR.reduce((sum, p) => sum + (p.ctr || 0), 0) / pagesWithCTR.length : 0
    const pagesWithPosition = crawled.filter(p => p.position !== null)
    const avg_position = pagesWithPosition.length > 0 ? pagesWithPosition.reduce((sum, p) => sum + (p.position || 0), 0) / pagesWithPosition.length : 0
    
    // Comparer avec benchmarks
    const pages_below_benchmark = crawled.filter(p => {
      if (!p.intent || !p.ctr || !benchmarks[p.intent]) return false
      return p.ctr < benchmarks[p.intent]
    }).length
    
    const top_performers = crawled
      .filter(p => p.ctr !== null && p.intent)
      .sort((a, b) => (b.ctr || 0) - (a.ctr || 0))
      .slice(0, 10)
      .map(p => ({ url: p.url, ctr: p.ctr || 0, intent: p.intent || 'unknown' }))
    
    const underperformers = crawled
      .filter(p => p.intent && p.ctr !== null && benchmarks[p.intent] && p.ctr < benchmarks[p.intent])
      .sort((a, b) => (a.ctr || 0) - (b.ctr || 0))
      .slice(0, 10)
      .map(p => ({
        url: p.url,
        ctr: p.ctr || 0,
        intent: p.intent || 'unknown',
        benchmark: benchmarks[p.intent || ''] || 0
      }))
    
    // 5. Générer recommandations
    const recommendations: AuditResult['recommendations'] = []
    
    // Recommandations High
    if (meta_formats.title_missing > 0) {
      recommendations.push({
        severity: 'high',
        category: 'Meta Title',
        title: `${meta_formats.title_missing} pages sans titre`,
        description: `Les pages sans balise <title> ont un impact négatif sur le SEO et le CTR.`,
        affected_pages: meta_formats.title_missing,
        examples: crawled.filter(p => !p.has_title).slice(0, 5).map(p => p.url)
      })
    }
    
    if (meta_formats.description_missing > 0) {
      recommendations.push({
        severity: 'high',
        category: 'Meta Description',
        title: `${meta_formats.description_missing} pages sans meta description`,
        description: `Les meta descriptions manquantes réduisent le CTR dans les résultats de recherche.`,
        affected_pages: meta_formats.description_missing,
        examples: crawled.filter(p => !p.has_description).slice(0, 5).map(p => p.url)
      })
    }
    
    if (pages_below_benchmark > 0) {
      recommendations.push({
        severity: 'high',
        category: 'Performance CTR',
        title: `${pages_below_benchmark} pages sous-performantes`,
        description: `Ces pages ont un CTR inférieur au benchmark moyen pour leur intent. Opportunité d'optimisation importante.`,
        affected_pages: pages_below_benchmark,
        examples: underperformers.slice(0, 5).map(p => p.url)
      })
    }
    
    // Recommandations Medium
    if (meta_formats.title_too_long > 0) {
      recommendations.push({
        severity: 'medium',
        category: 'Meta Title',
        title: `${meta_formats.title_too_long} titles trop longs (>55 chars)`,
        description: `Les titles trop longs seront tronqués dans les SERP, réduisant l'efficacité du message.`,
        affected_pages: meta_formats.title_too_long,
        examples: crawled.filter(p => p.title_length && p.title_length > 55).slice(0, 5).map(p => p.url)
      })
    }
    
    if (meta_formats.description_too_long > 0) {
      recommendations.push({
        severity: 'medium',
        category: 'Meta Description',
        title: `${meta_formats.description_too_long} descriptions trop longues (>150 chars)`,
        description: `Les descriptions trop longues seront tronquées dans les SERP.`,
        affected_pages: meta_formats.description_too_long,
        examples: crawled.filter(p => p.description_length && p.description_length > 150).slice(0, 5).map(p => p.url)
      })
    }
    
    if (intent_analysis.mismatch_count > 0) {
      recommendations.push({
        severity: 'medium',
        category: 'Intent',
        title: `${intent_analysis.mismatch_count} pages avec intent déclaré ≠ déduit`,
        description: `L'intent déclaré dans les meta/JSON-LD ne correspond pas à l'intent réel du contenu. Risque de confusion pour Google.`,
        affected_pages: intent_analysis.mismatch_count,
      })
    }
    
    if (rich_results.total_with_none > 0) {
      recommendations.push({
        severity: 'medium',
        category: 'Rich Results',
        title: `${rich_results.total_with_none} pages sans Rich Results`,
        description: `Ajouter des JSON-LD (FAQ, Rating, HowTo, etc.) peut améliorer la visibilité dans les SERP.`,
        affected_pages: rich_results.total_with_none,
      })
    }
    
    // Recommandations Low
    if (intent_analysis.missing > 0) {
      recommendations.push({
        severity: 'low',
        category: 'Intent',
        title: `${intent_analysis.missing} pages sans intent déclaré`,
        description: `Déclarer l'intent explicitement aide Google à mieux comprendre et positionner les pages.`,
        affected_pages: intent_analysis.missing,
      })
    }
    
    const duration_seconds = Math.round((Date.now() - startTime) / 1000)
    
    const result: AuditResult = {
      summary: {
        total_pages: pages.length,
        crawled: crawled.length,
        failed: failed.length,
        failed_pages: failed,
        duration_seconds
      },
      meta_formats,
      rich_results,
      intent_analysis,
      performance: {
        avg_ctr,
        avg_position,
        pages_below_benchmark,
        top_performers,
        underperformers
      },
      recommendations,
      pages: crawled.map(p => ({
        url: p.url,
        title_length: p.title_length,
        description_length: p.description_length,
        has_title: p.has_title,
        has_description: p.has_description,
        intent: p.intent,
        intent_source: p.intent_source,
        ctr: p.ctr,
        position: p.position,
        score_length: p.score_length,
        score_rich_results: p.score_rich_results,
        rich_results_types: p.rich_results_types
      }))
    }
    
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('❌ Erreur audit SERP:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

