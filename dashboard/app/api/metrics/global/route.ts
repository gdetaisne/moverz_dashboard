import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getGlobalMetrics } from '@/lib/bigquery'
import { validateQuery, handleZodError } from '@/lib/api-helpers'
import type { ApiSuccessResponse } from '@/lib/api-helpers'
import type { SiteMetrics } from '@/lib/bigquery'
import { metricsGlobalQuerySchema } from '@/lib/schemas/api'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // ✅ Validation Zod : days est garanti entre 1 et 365
    const params = validateQuery(request.nextUrl.searchParams, metricsGlobalQuerySchema)
    
    const data = await getGlobalMetrics(params.days)
    
    const response: ApiSuccessResponse<SiteMetrics[]> = {
      success: true,
      data,
      meta: {
        period: `${params.days} days`,
        count: data.length,
      }
    }
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    // Si erreur Zod, retourner 400 avec détails
    if (error instanceof z.ZodError) {
      return handleZodError(error)
    }
    // Fallback doux pour éviter de casser l'UI en dev sans credentials BigQuery
    const fallbackParams = metricsGlobalQuerySchema.safeParse({
      days: request.nextUrl.searchParams.get('days'),
    })
    const days = fallbackParams.success ? fallbackParams.data.days : 7
    const sitesEnv = (process.env.SITES_LIST || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const dataFallback: SiteMetrics[] = sitesEnv.map((site) => ({
      site,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      trend_clicks: 0,
      trend_impressions: 0,
    }))
    
    const response: ApiSuccessResponse<SiteMetrics[]> = {
      success: true,
      data: dataFallback,
      meta: { period: `${days} days`, count: dataFallback.length, fallback: 'bigquery_unavailable' }
    }
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

