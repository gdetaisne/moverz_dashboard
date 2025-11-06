import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTopPages } from '@/lib/bigquery'
import { validateQuery, handleZodError } from '@/lib/api-helpers'
import type { ApiSuccessResponse } from '@/lib/api-helpers'
import { metricsPagesQuerySchema } from '@/lib/schemas/api'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // ✅ Validation Zod : site (optionnel), limit (1-1000, default=20, accepte 0 pour "tous")
    const params = validateQuery(request.nextUrl.searchParams, metricsPagesQuerySchema)
    
    const data = await getTopPages(params.site, params.limit)
    
    const response: ApiSuccessResponse = {
      success: true,
      data,
      meta: {
        site: params.site || 'all',
        limit: params.limit,
        count: data.length,
      }
    }
    return NextResponse.json(response)
  } catch (error) {
    // Si erreur Zod, retourner 400 avec détails
    if (error instanceof z.ZodError) {
      return handleZodError(error)
    }
    
    logger.error('[metrics/pages] API error', error, { route: '/api/metrics/pages' })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

