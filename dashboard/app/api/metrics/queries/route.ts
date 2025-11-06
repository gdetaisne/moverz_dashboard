import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTopQueries } from '@/lib/bigquery'
import { validateQuery, handleZodError } from '@/lib/api-helpers'
import type { ApiSuccessResponse } from '@/lib/api-helpers'
import { metricsQueriesQuerySchema } from '@/lib/schemas/api'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // ✅ Validation Zod : site (optionnel), limit (1-1000, default=20)
    const params = validateQuery(request.nextUrl.searchParams, metricsQueriesQuerySchema)
    
    const data = await getTopQueries(params.site, params.limit)
    
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
    
    logger.error('[metrics/queries] API error', error, { route: '/api/metrics/queries' })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

