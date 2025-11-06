import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTimeSeriesData } from '@/lib/bigquery'
import { validateQuery, handleZodError } from '@/lib/api-helpers'
import type { ApiSuccessResponse } from '@/lib/api-helpers'
import { metricsTimeseriesQuerySchema } from '@/lib/schemas/api'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // ✅ Validation Zod : days (1-365), site (string optionnel)
    const params = validateQuery(request.nextUrl.searchParams, metricsTimeseriesQuerySchema)
    
    const data = await getTimeSeriesData(params.site, params.days)
    
    const response: ApiSuccessResponse = {
      success: true,
      data,
      meta: {
        site: params.site || 'all',
        period: `${params.days} days`,
        count: data.length,
      }
    }
    return NextResponse.json(response)
  } catch (error) {
    // Si erreur Zod, retourner 400 avec détails
    if (error instanceof z.ZodError) {
      return handleZodError(error)
    }
    
    logger.error('[metrics/timeseries] API error', error, { route: '/api/metrics/timeseries' })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

